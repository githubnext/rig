import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const run = vi.fn();
  const startThread = vi.fn(() => ({ run }));
  const constructor = vi.fn();
  const Codex = function (this: unknown, options: unknown) {
    constructor(options);
    return { startThread };
  };
  return { run, startThread, constructor, Codex };
});

vi.mock("@openai/codex-sdk", () => ({ Codex: mocks.Codex }));

import { defineTool } from "rig";
import { codexEngine } from "rig/engines/codex";

beforeEach(() => {
  mocks.constructor.mockReset();
  mocks.startThread.mockClear();
  mocks.run.mockReset();
  mocks.run.mockResolvedValue({ finalResponse: "codex response" });
});

it("creates a Codex thread and preserves its conversation", async () => {
  const signal = new AbortController().signal;
  const runtimeAgent = await codexEngine({
    apiKey: "test-key",
    config: { show_raw_agent_reasoning: true },
    thread: {
      workingDirectory: "/workspace",
      approvalPolicy: "never",
    },
  })({
    model: "gpt-5-codex",
    systemMessage: "Be concise.",
  });

  await expect(runtimeAgent.ask("first", { signal })).resolves.toBe("codex response");
  await expect(runtimeAgent.ask("second")).resolves.toBe("codex response");

  expect(mocks.constructor).toHaveBeenCalledWith({
    apiKey: "test-key",
    config: {
      show_raw_agent_reasoning: true,
      developer_instructions: "Be concise.",
    },
  });
  expect(mocks.startThread).toHaveBeenCalledOnce();
  expect(mocks.startThread).toHaveBeenCalledWith({
    model: "gpt-5-codex",
    workingDirectory: "/workspace",
    approvalPolicy: "never",
  });
  const firstSignal = mocks.run.mock.calls[0]![1].signal as AbortSignal;
  const secondSignal = mocks.run.mock.calls[1]![1].signal as AbortSignal;
  expect(firstSignal).not.toBe(signal);
  expect(firstSignal.aborted).toBe(false);
  expect(secondSignal.aborted).toBe(false);
});

it("uses Codex defaults when optional configuration is absent", async () => {
  const runtimeAgent = await codexEngine()({ model: "gpt-5-codex" });

  await runtimeAgent.ask("hello");

  expect(mocks.constructor).toHaveBeenCalledWith({});
  expect(mocks.startThread).toHaveBeenCalledWith({ model: "gpt-5-codex" });
});

it("forwards output schemas to Codex and stringifies structured responses", async () => {
  const runtimeAgent = await codexEngine()({ model: "gpt-5-codex" });
  const outputSchema = {
    type: "object",
    properties: {
      summary: { type: "string" },
    },
    required: ["summary"],
    additionalProperties: false,
  } as const;
  mocks.run.mockResolvedValueOnce({ finalResponse: { summary: "done" } });

  await expect(runtimeAgent.ask("summarize", { outputSchema })).resolves.toBe(JSON.stringify({ summary: "done" }));

  expect(mocks.run).toHaveBeenCalledWith(
    "summarize",
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      outputSchema,
    }),
  );
});

it("rejects non-string system messages", () => {
  const factory = codexEngine();

  expect(() => factory({ model: "gpt-5-codex", systemMessage: [] }))
    .toThrow("codexEngine requires systemMessage to be a string");
});

it("rejects Rig tools because the Codex SDK does not support custom tools", () => {
  const factory = codexEngine();
  const tool = defineTool("echo", { handler: () => "ok" });

  expect(() => factory({ model: "gpt-5-codex", tools: [tool] }))
    .toThrow("codexEngine does not support Rig tools");
});

it("forwards caller cancellation to an active Codex turn", async () => {
  mocks.run.mockImplementationOnce((_prompt, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  const runtimeAgent = await codexEngine()({ model: "gpt-5-codex" });
  const controller = new AbortController();
  const result = runtimeAgent.ask("hello", { signal: controller.signal });

  controller.abort(new Error("cancelled"));

  await expect(result).rejects.toThrow("cancelled");
});

it("aborts and waits for active Codex turns when closed", async () => {
  let turnSignal: AbortSignal | undefined;
  mocks.run.mockImplementationOnce((_prompt, options) => new Promise((_resolve, reject) => {
    turnSignal = options.signal;
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  const runtimeAgent = await codexEngine()({ model: "gpt-5-codex" });
  const result = runtimeAgent.ask("hello");

  await runtimeAgent.close();

  await expect(result).rejects.toThrow("Agent closed");
  expect(turnSignal?.aborted).toBe(true);
  await expect(runtimeAgent.ask("after close")).rejects.toThrow("Agent closed");
});
