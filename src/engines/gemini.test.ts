import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  randomUUID: vi.fn(() => "new-session"),
}));

vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:crypto", () => ({ randomUUID: mocks.randomUUID }));

import { defineTool } from "rig";
import { geminiEngine } from "rig/engines/gemini";

type MockChild = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
};

function childProcess(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

function respond(child: MockChild, output: unknown, code = 0): void {
  queueMicrotask(() => {
    child.stdout.end(JSON.stringify(output));
    child.emit("close", code);
  });
}

beforeEach(() => {
  mocks.spawn.mockReset();
  mocks.randomUUID.mockClear();
});

it("starts and resumes a Gemini CLI session", async () => {
  mocks.spawn
    .mockImplementationOnce(() => {
      const child = childProcess();
      respond(child, { session_id: "saved-session", response: "first response" });
      return child;
    })
    .mockImplementationOnce(() => {
      const child = childProcess();
      respond(child, { session_id: "saved-session", response: "second response" });
      return child;
    });
  const runtimeAgent = await geminiEngine()({
    model: "gemini-test",
    systemMessage: "Be concise.",
  });

  await expect(runtimeAgent.ask("first")).resolves.toBe("first response");
  await expect(runtimeAgent.ask("second")).resolves.toBe("second response");

  expect(mocks.spawn.mock.calls[0]![1]).toEqual([
    "--model",
    "gemini-test",
    "--output-format",
    "json",
    "--session-id",
    "new-session",
    "--prompt",
    "Be concise.\n\nfirst",
  ]);
  expect(mocks.spawn.mock.calls[1]![1]).toEqual([
    "--model",
    "gemini-test",
    "--output-format",
    "json",
    "--resume",
    "saved-session",
    "--prompt",
    "second",
  ]);
});

it("forwards Gemini CLI process options", async () => {
  mocks.spawn.mockImplementationOnce(() => {
    const child = childProcess();
    respond(child, { response: "ok" });
    return child;
  });
  const runtimeAgent = await geminiEngine({
    command: "/opt/bin/gemini",
    cwd: "/workspace",
    args: ["--sandbox"],
    env: { GEMINI_API_KEY: "test-key" },
    approvalMode: "plan",
  })({ model: "gemini-test" });

  await runtimeAgent.ask("hello");

  expect(mocks.spawn).toHaveBeenCalledWith(
    "/opt/bin/gemini",
    [
      "--sandbox",
      "--model",
      "gemini-test",
      "--output-format",
      "json",
      "--approval-mode",
      "plan",
      "--session-id",
      "new-session",
      "--prompt",
      "hello",
    ],
    expect.objectContaining({
      cwd: "/workspace",
      env: expect.objectContaining({ GEMINI_API_KEY: "test-key" }),
      signal: expect.any(AbortSignal),
    }),
  );
});

it("reports CLI and JSON response errors", async () => {
  mocks.spawn
    .mockImplementationOnce(() => {
      const child = childProcess();
      queueMicrotask(() => {
        child.stderr.end("authentication failed");
        child.emit("close", 1);
      });
      return child;
    })
    .mockImplementationOnce(() => {
      const child = childProcess();
      respond(child, { error: { message: "request failed" } });
      return child;
    });
  const runtimeAgent = await geminiEngine()({ model: "gemini-test" });

  await expect(runtimeAgent.ask("first")).rejects.toThrow("authentication failed");
  await expect(runtimeAgent.ask("second")).rejects.toThrow("request failed");
});

it("rejects unsupported agent options", () => {
  const tool = defineTool("echo", { handler: () => "ok" });

  expect(() => geminiEngine()({ model: "gemini-test", tools: [tool] }))
    .toThrow("geminiEngine does not support Rig tools");
  expect(() => geminiEngine()({ model: "gemini-test", systemMessage: [] }))
    .toThrow("geminiEngine requires systemMessage to be a string");
});

it("aborts an active Gemini CLI process when closed", async () => {
  let processSignal: AbortSignal | undefined;
  mocks.spawn.mockImplementationOnce((_command, _args, options) => {
    const child = childProcess();
    processSignal = options.signal;
    options.signal.addEventListener("abort", () => {
      child.emit("error", options.signal.reason);
      queueMicrotask(() => child.emit("close", null));
    }, { once: true });
    return child;
  });
  const runtimeAgent = await geminiEngine()({ model: "gemini-test" });
  const result = runtimeAgent.ask("hello");

  await runtimeAgent.close();

  await expect(result).rejects.toThrow("Agent closed");
  expect(processSignal?.aborted).toBe(true);
  await expect(runtimeAgent.ask("after close")).rejects.toThrow("Agent closed");
});

it("does not spawn for a pre-aborted turn", async () => {
  const runtimeAgent = await geminiEngine()({ model: "gemini-test" });
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));

  await expect(runtimeAgent.ask("hello", { signal: controller.signal }))
    .rejects.toThrow("cancelled");
  expect(mocks.spawn).not.toHaveBeenCalled();
});
