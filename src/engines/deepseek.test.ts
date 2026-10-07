import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  createHarness: vi.fn(),
  session: vi.fn(),
  run: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@deepseek-ai/dsh-sdk-client", () => ({
  DeepSeekHarness: function (options: unknown) {
    mocks.constructor(options);
    return mocks.createHarness(options) ?? { session: mocks.session, close: mocks.close };
  },
}));

import { agent, configureAgent, defineTool, repair, s } from "rig";
import { deepseekEngine } from "rig/engines/deepseek";

function completed(finalResponse = "ok") {
  return {
    sessionId: "session-test",
    finalResponse,
    events: [{ type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } }],
    notifications: [],
  };
}

beforeEach(() => {
  mocks.constructor.mockReset();
  mocks.createHarness.mockReset();
  mocks.session.mockReset().mockReturnValue({ id: "session-test", run: mocks.run });
  mocks.run.mockReset().mockResolvedValue(completed());
  mocks.close.mockReset().mockResolvedValue(undefined);
});

it("preserves one SDK session and prepends system instructions only on the first turn", async () => {
  mocks.run.mockResolvedValueOnce(completed("first")).mockResolvedValueOnce(completed("second"));
  const runtimeAgent = await deepseekEngine()({ model: "small", systemMessage: "Be concise." });

  await expect(runtimeAgent.ask("hello")).resolves.toBe("first");
  await expect(runtimeAgent.ask("repair")).resolves.toBe("second");
  expect(mocks.constructor).toHaveBeenCalledExactlyOnceWith({ model: "small" });
  expect(mocks.session).toHaveBeenCalledExactlyOnceWith();
  expect(mocks.run.mock.calls).toEqual([["Be concise.\n\nhello"], ["repair"]]);
  expect(mocks.close).not.toHaveBeenCalled();
  await runtimeAgent.close();
});

it("forwards SDK launch options and uses the agent model", async () => {
  const options = {
    dshBin: "/runtime/dsh.js",
    profile: "sdk-minimal",
    patches: ["/runtime/custom.yml"],
    dshHome: "/runtime/home",
    cwd: "/workspace",
    processCwd: "/workspace",
    provider: "test-provider",
    maxTokens: 1000,
    env: { DEEPSEEK_API_KEY: "test-key" },
    initializeTimeoutMs: 100,
    requestTimeoutMs: 200,
    shutdownTimeoutMs: 300,
    disposeEofGraceMs: 400,
    disposeGraceMs: 500,
  };
  const runtimeAgent = await deepseekEngine(options)({ model: "small" });

  await runtimeAgent.ask("hello", { outputSchema: { type: "object" } });
  expect(mocks.constructor).toHaveBeenCalledExactlyOnceWith({ ...options, model: "small" });
  expect(mocks.run).toHaveBeenCalledExactlyOnceWith("hello");
  await runtimeAgent.close();
});

it("preserves the session across Rig's structured-output repair turns", async () => {
  mocks.run.mockResolvedValueOnce(completed("not JSON")).mockResolvedValueOnce(completed('{"count":2}'));
  configureAgent(deepseekEngine());
  const count = agent({
    model: "small",
    instructions: "Count.",
    output: s.object({ count: s.int }),
    addons: [repair()],
  });

  await expect(count("")).resolves.toEqual({ count: 2 });
  expect(mocks.session).toHaveBeenCalledTimes(1);
  expect(mocks.run).toHaveBeenCalledTimes(2);
  expect(mocks.run.mock.calls[0]![0]).toContain("<output_schema>");
  expect(mocks.run.mock.calls[1]![0]).toContain("previous response");
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

it("rejects Rig tools and non-string system messages before constructing a harness", () => {
  const tool = defineTool("echo", { handler: () => "ok" });

  expect(() => deepseekEngine()({ model: "small", tools: [tool] }))
    .toThrow("deepseekEngine does not support Rig tools");
  expect(() => deepseekEngine()({ model: "small", systemMessage: [] }))
    .toThrow("deepseekEngine requires systemMessage to be a string");
  expect(mocks.constructor).not.toHaveBeenCalled();
});

it("does not start a turn for a pre-aborted signal", async () => {
  const runtimeAgent = await deepseekEngine()({ model: "small" });
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));

  await expect(runtimeAgent.ask("hello", { signal: controller.signal })).rejects.toThrow("cancelled");
  expect(mocks.run).not.toHaveBeenCalled();
  await runtimeAgent.close();
});

it("rejects overlapping turns without disturbing the active turn", async () => {
  let finish: ((result: ReturnType<typeof completed>) => void) | undefined;
  mocks.run.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const runtimeAgent = await deepseekEngine()({ model: "small" });
  const first = runtimeAgent.ask("first");

  await expect(runtimeAgent.ask("overlap")).rejects.toThrow("does not support concurrent turns");
  expect(mocks.close).not.toHaveBeenCalled();
  finish?.(completed("first"));
  await expect(first).resolves.toBe("first");
  await expect(runtimeAgent.ask("next")).resolves.toBe("ok");
  await runtimeAgent.close();
});

it.each(["abort", "close"])("reaps an active runtime on %s and rejects further turns", async (action) => {
  let rejectRun: ((error: Error) => void) | undefined;
  mocks.run.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRun = reject; }));
  mocks.close.mockImplementationOnce(async () => { rejectRun?.(new Error("transport closed")); });
  const runtimeAgent = await deepseekEngine()({ model: "small" });
  const controller = new AbortController();
  const result = runtimeAgent.ask("wait", { signal: controller.signal });
  const rejected = expect(result).rejects.toThrow(action === "abort" ? "cancelled" : "Agent closed");

  if (action === "abort") {
    controller.abort(new Error("cancelled"));
  } else {
    await runtimeAgent.close();
  }

  await rejected;
  expect(mocks.close).toHaveBeenCalledTimes(1);
  await expect(runtimeAgent.ask("next")).rejects.toThrow("closed");
  await runtimeAgent.close();
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

it("does not accept a successful result delivered after cancellation", async () => {
  const controller = new AbortController();
  mocks.run.mockImplementationOnce(async () => {
    controller.abort(new Error("cancelled"));
    return completed("stale response");
  });
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await expect(runtimeAgent.ask("hello", { signal: controller.signal })).rejects.toThrow("cancelled");
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

it("closes an unused harness exactly once", async () => {
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await runtimeAgent.close();
  await runtimeAgent.close();
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.run).not.toHaveBeenCalled();
  await expect(runtimeAgent.ask("next")).rejects.toThrow("Agent closed");
});

it("propagates SDK errors and closes the runtime before settling", async () => {
  const error = new Error("handshake failed");
  mocks.run.mockRejectedValueOnce(error);
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await expect(runtimeAgent.ask("hello")).rejects.toBe(error);
  expect(mocks.close).toHaveBeenCalledTimes(1);
  await expect(runtimeAgent.ask("retry")).rejects.toThrow("deepseekEngine is closed");
});

it.each(["blocked", "max-tokens", "aborted", "interrupted"])(
  "rejects %s outcomes even when the SDK returns assistant text",
  async (kind) => {
    mocks.run.mockResolvedValueOnce({
      ...completed("partial response"),
      events: [{ type: "turn/end", data: { reason: { kind } } }],
    });
    const runtimeAgent = await deepseekEngine()({ model: "small" });

    await expect(runtimeAgent.ask("hello")).rejects.toThrow(`turn ended with ${kind}`);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  },
);

it("surfaces model errors from turn/end events instead of returning stale assistant text", async () => {
  const error = { message: "authentication failed", code: "MISSING_CREDENTIAL" };
  mocks.run.mockResolvedValueOnce({
    ...completed("partial response"),
    events: [{ type: "turn/end", data: { reason: { kind: "error", error } } }],
  });
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await expect(runtimeAgent.ask("hello")).rejects.toMatchObject({
    message: "DeepSeek Harness request failed: authentication failed",
    cause: error,
  });
  expect(mocks.close).toHaveBeenCalledTimes(1);
});

it("rejects a run without a terminal turn event", async () => {
  mocks.run.mockResolvedValueOnce({ ...completed(), events: [] });
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await expect(runtimeAgent.ask("hello")).rejects.toThrow("returned no completed turn");
});

it("preserves both a request error and a cleanup failure", async () => {
  const error = new Error("request failed");
  const cleanupError = new Error("runtime could not exit");
  mocks.run.mockRejectedValueOnce(error);
  mocks.close.mockRejectedValueOnce(cleanupError);
  const runtimeAgent = await deepseekEngine()({ model: "small" });

  await expect(runtimeAgent.ask("hello")).rejects.toMatchObject({
    message: "DeepSeek Harness request and cleanup failed",
    errors: [error, cleanupError],
  });
  await expect(runtimeAgent.close()).rejects.toBe(cleanupError);
});

it("preserves cancellation and cleanup errors without hanging on an unsettled SDK run", async () => {
  mocks.run.mockImplementationOnce(() => new Promise(() => {}));
  const cleanupError = new Error("runtime could not exit");
  mocks.close.mockRejectedValueOnce(cleanupError);
  const runtimeAgent = await deepseekEngine()({ model: "small" });
  const controller = new AbortController();
  const error = new Error("cancelled");
  const result = runtimeAgent.ask("wait", { signal: controller.signal });
  controller.abort(error);

  await expect(result).rejects.toMatchObject({ errors: [error, cleanupError] });
  await expect(runtimeAgent.close()).rejects.toBe(cleanupError);
});

it("drives a real SDK subprocess and retains conversation history across turns", async () => {
  const { DeepSeekHarness } = await vi.importActual<typeof import("@deepseek-ai/dsh-sdk-client")>(
    "@deepseek-ai/dsh-sdk-client",
  );
  mocks.createHarness.mockImplementationOnce((options) => new DeepSeekHarness(options));
  const runtimeAgent = await deepseekEngine({
    dshBin: fileURLToPath(new URL("./deepseek.fixture.ts", import.meta.url)),
    cwd: resolve("."),
    initializeTimeoutMs: 2_000,
  })({ model: "small" });

  try {
    await expect(runtimeAgent.ask("first", { signal: AbortSignal.timeout(5_000) })).resolves.toBe("first");
    await expect(runtimeAgent.ask("second", { signal: AbortSignal.timeout(5_000) })).resolves.toBe("first|second");
  } finally {
    await runtimeAgent.close();
  }
});

it("cancels a real SDK subprocess waiting for a turn to finish", async () => {
  const { DeepSeekHarness } = await vi.importActual<typeof import("@deepseek-ai/dsh-sdk-client")>(
    "@deepseek-ai/dsh-sdk-client",
  );
  mocks.createHarness.mockImplementationOnce((options) => new DeepSeekHarness(options));
  const runtimeAgent = await deepseekEngine({
    dshBin: fileURLToPath(new URL("./deepseek.fixture.ts", import.meta.url)),
    initializeTimeoutMs: 2_000,
    shutdownTimeoutMs: 100,
    disposeEofGraceMs: 100,
    disposeGraceMs: 100,
  })({ model: "small" });

  try {
    await expect(runtimeAgent.ask("first", { signal: AbortSignal.timeout(5_000) })).resolves.toBe("first");
    await expect(runtimeAgent.ask("wait", { signal: AbortSignal.timeout(100) }))
      .rejects.toThrow("operation was aborted due to timeout");
    await expect(runtimeAgent.ask("next")).rejects.toThrow("deepseekEngine is closed");
  } finally {
    await runtimeAgent.close();
  }
});
