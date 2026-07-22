import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const abort = vi.fn();
  const prompt = vi.fn();
  const waitForIdle = vi.fn();
  const state = { messages: [] as unknown[] };
  const constructor = vi.fn();
  const Agent = function (this: unknown, options: unknown) {
    constructor(options);
    return { abort, prompt, waitForIdle, state };
  };
  return { abort, prompt, waitForIdle, state, constructor, Agent };
});

vi.mock("@earendil-works/pi-agent-core", () => ({ Agent: mocks.Agent }));

import { defineTool, s } from "rig";
import { piEngine } from "rig/engines/pi";

beforeEach(() => {
  mocks.abort.mockReset();
  mocks.prompt.mockReset();
  mocks.waitForIdle.mockReset();
  mocks.waitForIdle.mockResolvedValue(undefined);
  mocks.constructor.mockReset();
  mocks.state.messages = [{ role: "assistant", content: [{ type: "text", text: "pi response" }] }];
  delete (mocks.state as { errorMessage?: string }).errorMessage;
});

it("creates a pi-agent with the configured model, system prompt, and tools", async () => {
  const model = { id: "test-model" };
  const models = {
    getModel: vi.fn(() => model),
    streamSimple: vi.fn(),
  };
  const handler = vi.fn(async ({ value }: { value: string }) => ({ echoed: value }));
  const tool = defineTool("echo", {
    description: "Echo a value",
    parameters: s.object({ value: s.string }),
    handler,
  });

  const runtimeAgent = await piEngine({ provider: "test", models: models as any })({
    model: "test-model",
    systemMessage: "Be concise.",
    tools: [tool],
  });
  const result = await runtimeAgent.ask("hello");

  expect(models.getModel).toHaveBeenCalledWith("test", "test-model");
  expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({
    initialState: expect.objectContaining({
      model,
      systemPrompt: "Be concise.",
      tools: [expect.objectContaining({ name: "echo", label: "echo", description: "Echo a value" })],
    }),
  }));
  expect(mocks.prompt).toHaveBeenCalledWith("hello");
  expect(result).toBe("pi response");

  const options = mocks.constructor.mock.calls[0]![0] as any;
  await expect(options.initialState.tools[0].execute("call-1", { value: "ok" })).resolves.toEqual({
    content: [{ type: "text", text: "{\"echoed\":\"ok\"}" }],
    details: { echoed: "ok" },
  });
  expect(handler).toHaveBeenCalledWith({ value: "ok" });
});

it("aborts and waits for the pi-agent when closed", async () => {
  const models = { getModel: vi.fn(() => ({ id: "test-model" })), streamSimple: vi.fn() };
  const runtimeAgent = await piEngine({ provider: "test", models: models as any })({ model: "test-model" });

  await runtimeAgent.close();

  expect(mocks.abort).toHaveBeenCalledOnce();
  expect(mocks.waitForIdle).toHaveBeenCalledOnce();
});

it("propagates pi-agent provider failures", async () => {
  const models = { getModel: vi.fn(() => ({ id: "test-model" })), streamSimple: vi.fn() };
  const runtimeAgent = await piEngine({ provider: "test", models: models as any })({ model: "test-model" });
  (mocks.state as { errorMessage?: string }).errorMessage = "provider failed";

  await expect(runtimeAgent.ask("hello")).rejects.toThrow("provider failed");
});

it("aborts an in-flight pi-agent prompt", async () => {
  const models = { getModel: vi.fn(() => ({ id: "test-model" })), streamSimple: vi.fn() };
  const runtimeAgent = await piEngine({ provider: "test", models: models as any })({ model: "test-model" });
  const controller = new AbortController();
  mocks.prompt.mockImplementation(async () => controller.abort(new Error("cancelled")));

  await expect(runtimeAgent.ask("hello", { signal: controller.signal })).rejects.toThrow("cancelled");
  expect(mocks.abort).toHaveBeenCalledOnce();
});

it("rejects non-string pi-agent system messages", () => {
  const models = { getModel: vi.fn(() => ({ id: "test-model" })), streamSimple: vi.fn() };
  const factory = piEngine({ provider: "test", models: models as any });

  expect(() => factory({ model: "test-model", systemMessage: [] as any }))
    .toThrow("piEngine requires systemMessage to be a string");
});

it("rejects unknown pi-agent models", () => {
  const models = { getModel: vi.fn(() => undefined), streamSimple: vi.fn() };
  const factory = piEngine({ provider: "test", models: models as any });

  expect(() => factory({ model: "missing" })).toThrow("Unknown pi-agent model: test/missing");
});
