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
  expect(mocks.run).toHaveBeenNthCalledWith(1, "first", { signal });
  expect(mocks.run).toHaveBeenNthCalledWith(2, "second", undefined);
});

it("uses Codex defaults when optional configuration is absent", async () => {
  const runtimeAgent = await codexEngine()({ model: "gpt-5-codex" });

  await runtimeAgent.ask("hello");

  expect(mocks.constructor).toHaveBeenCalledWith({});
  expect(mocks.startThread).toHaveBeenCalledWith({ model: "gpt-5-codex" });
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
