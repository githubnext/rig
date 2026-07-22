import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const toolRunner = vi.fn();
  const constructor = vi.fn();
  const Anthropic = function (this: unknown, options: unknown) {
    constructor(options);
    return { beta: { messages: { toolRunner } } };
  };
  const betaTool = vi.fn((tool) => tool);
  return { toolRunner, constructor, Anthropic, betaTool };
});

vi.mock("@anthropic-ai/sdk", () => ({ default: mocks.Anthropic }));
vi.mock("@anthropic-ai/sdk/helpers/beta/json-schema", () => ({ betaTool: mocks.betaTool }));

import { defineTool, s } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

beforeEach(() => {
  mocks.constructor.mockReset();
  mocks.betaTool.mockClear();
  mocks.toolRunner.mockReset();
  mocks.toolRunner.mockImplementation((params) => ({
    async runUntilDone() {
      return { content: [{ type: "text", text: `response ${params.messages.length}` }] };
    },
    params: {
      messages: [...params.messages, { role: "assistant", content: [{ type: "text", text: "saved" }] }],
    },
  }));
});

it("creates an Anthropic tool runner and preserves its conversation", async () => {
  const signal = new AbortController().signal;
  const runtimeAgent = await anthropicEngine({
    apiKey: "test-key",
    maxTokens: 2048,
    maxIterations: 3,
  })({
    model: "claude-test",
    systemMessage: "Be concise.",
  });

  await expect(runtimeAgent.ask("first", { signal })).resolves.toBe("response 1");
  await expect(runtimeAgent.ask("second")).resolves.toBe("response 3");

  expect(mocks.constructor).toHaveBeenCalledWith({ apiKey: "test-key" });
  expect(mocks.toolRunner).toHaveBeenNthCalledWith(1, {
    model: "claude-test",
    max_tokens: 2048,
    max_iterations: 3,
    messages: [{ role: "user", content: "first" }],
    system: "Be concise.",
    tools: [],
  }, { signal });
  expect(mocks.toolRunner.mock.calls[1]![0].messages).toEqual([
    { role: "user", content: "first" },
    { role: "assistant", content: [{ type: "text", text: "saved" }] },
    { role: "user", content: "second" },
  ]);
});

it("maps Rig tools to Anthropic runnable tools", async () => {
  const handler = vi.fn(async ({ value }: { value: string }) => ({ echoed: value }));
  const tool = defineTool("echo", {
    description: "Echo a value",
    parameters: s.object({ value: s.string }),
    handler,
  });

  anthropicEngine()({ model: "claude-test", tools: [tool] });

  expect(mocks.betaTool).toHaveBeenCalledWith(expect.objectContaining({
    name: "echo",
    description: "Echo a value",
    inputSchema: expect.objectContaining({ type: "object" }),
  }));
  const anthropicTool = mocks.betaTool.mock.calls[0]![0];
  await expect(anthropicTool.run({ value: "ok" })).resolves.toBe("{\"echoed\":\"ok\"}");
  expect(handler).toHaveBeenCalledWith({ value: "ok" });
});

it("does not retain a failed Anthropic turn", async () => {
  mocks.toolRunner
    .mockImplementationOnce(() => ({
      runUntilDone: vi.fn().mockRejectedValue(new Error("request failed")),
      params: { messages: [] },
    }));
  const runtimeAgent = await anthropicEngine()({ model: "claude-test" });

  await expect(runtimeAgent.ask("failed")).rejects.toThrow("request failed");
  await expect(runtimeAgent.ask("retry")).resolves.toBe("response 1");

  expect(mocks.toolRunner.mock.calls[1]![0].messages).toEqual([
    { role: "user", content: "retry" },
  ]);
});

it("uses Anthropic request defaults and returns all text blocks", async () => {
  mocks.toolRunner.mockImplementationOnce((params) => ({
    async runUntilDone() {
      return {
        content: [
          { type: "text", text: "first" },
          { type: "tool_use", id: "tool-1" },
          { type: "text", text: " second" },
        ],
      };
    },
    params,
  }));
  const runtimeAgent = await anthropicEngine()({ model: "claude-test" });

  await expect(runtimeAgent.ask("hello")).resolves.toBe("first second");
  expect(mocks.toolRunner).toHaveBeenCalledWith({
    model: "claude-test",
    max_tokens: 8192,
    messages: [{ role: "user", content: "hello" }],
    tools: [],
  }, undefined);
});
