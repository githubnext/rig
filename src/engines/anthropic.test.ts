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
vi.mock("@anthropic-ai/sdk/helpers/beta/json-schema", async (importOriginal) => ({
  ...await importOriginal<typeof import("@anthropic-ai/sdk/helpers/beta/json-schema")>(),
  betaTool: mocks.betaTool,
}));

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
  }, { signal: expect.any(AbortSignal) });
  const requestSignal = mocks.toolRunner.mock.calls[0]![1].signal as AbortSignal;
  expect(requestSignal.aborted).toBe(false);
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
  }, { signal: expect.any(AbortSignal) });
});

it("forwards object output schemas using the SDK structured-output helper", async () => {
  const runtimeAgent = await anthropicEngine()({ model: "small" });
  const outputSchema = {
    type: "object",
    properties: { answer: { type: "string", minLength: 1 } },
    required: ["answer"],
  };

  await runtimeAgent.ask("hello", { outputSchema });

  expect(mocks.toolRunner.mock.calls[0]![0].output_config).toEqual({
    format: expect.objectContaining({
      type: "json_schema",
      schema: expect.objectContaining({ type: "object", additionalProperties: false }),
    }),
  });
  expect(outputSchema.properties.answer.minLength).toBe(1);
});

it.each([
  { type: "string" },
  { type: "array", items: { type: "string" } },
  { type: "object", additionalProperties: { type: "string" } },
  { type: "object", properties: { value: {} } },
  { type: "object", properties: { values: { type: "object", additionalProperties: { type: "number" } } } },
  { type: "object", properties: { value: { enum: [1, 2] } } },
])(
  "keeps schemas unsupported by Anthropic structured output prompt-driven: %j",
  async (outputSchema) => {
    const runtimeAgent = await anthropicEngine()({ model: "small" });

    await runtimeAgent.ask("hello", { outputSchema });

    expect(mocks.toolRunner.mock.calls[0]![0]).not.toHaveProperty("output_config");
  },
);

it("supports nested typed properties, arrays, enums, and nullable fields", async () => {
  const runtimeAgent = await anthropicEngine()({ model: "small" });
  const outputSchema = {
    type: "object",
    properties: {
      values: { type: "array", items: { type: "object", properties: { ok: { type: "boolean" } } } },
      status: { type: "string", enum: ["ok", "failed"] },
      reason: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
  };

  await runtimeAgent.ask("hello", { outputSchema });

  expect(mocks.toolRunner.mock.calls[0]![0].output_config.format.schema.properties).toEqual({
    values: {
      type: "array",
      items: { type: "object", properties: { ok: { type: "boolean" } }, additionalProperties: false },
    },
    status: expect.objectContaining({ type: "string" }),
    reason: { anyOf: [{ type: "string" }, { type: "null" }] },
  });
});

it.each([42, { content: "not an Anthropic system prompt" }, [{ type: "image" }]])(
  "rejects invalid Anthropic system messages before creating a client: %j",
  (systemMessage) => {
    expect(() => anthropicEngine()({ model: "small", systemMessage })).toThrow("anthropicEngine requires systemMessage");
    expect(mocks.constructor).not.toHaveBeenCalled();
  },
);

it("preserves Anthropic system text blocks", async () => {
  const systemMessage = [{ type: "text", text: "Be concise.", cache_control: { type: "ephemeral" } }];
  const runtimeAgent = await anthropicEngine()({ model: "small", systemMessage });

  await runtimeAgent.ask("hello");

  expect(mocks.toolRunner.mock.calls[0]![0].system).toEqual(systemMessage);
});

it("aborts and waits for active Anthropic requests on close", async () => {
  mocks.toolRunner.mockImplementationOnce((params, options) => ({
    runUntilDone: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }),
    params,
  }));
  const runtimeAgent = await anthropicEngine()({ model: "small" });
  const result = runtimeAgent.ask("hello");

  await runtimeAgent.close();

  await expect(result).rejects.toThrow("Agent closed");
  await expect(runtimeAgent.ask("after close")).rejects.toThrow("Agent closed");
});

it("does not start a pre-aborted Anthropic turn", async () => {
  const runtimeAgent = await anthropicEngine()({ model: "small" });
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));

  await expect(runtimeAgent.ask("hello", { signal: controller.signal })).rejects.toThrow("cancelled");
  expect(mocks.toolRunner).not.toHaveBeenCalled();
});
