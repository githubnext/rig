import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const approveAll = vi.fn();
  const createSession = vi.fn();
  const stop = vi.fn();
  const forTcp = vi.fn((host: string, port: number, options?: { connectionToken: string }) => ({ kind: "tcp", host, port, ...options }));
  const forSpawnedStdio = vi.fn(() => ({ kind: "spawned-stdio" }));
  const copilotClientCtor = vi.fn();
  const CopilotClient = function (this: unknown, options: unknown) {
    copilotClientCtor(options);
    return { createSession, stop };
  };
  return { approveAll, createSession, stop, forTcp, forSpawnedStdio, copilotClientCtor, CopilotClient };
});

vi.mock("@microsoft/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forTcp: mocks.forTcp, forSpawnedStdio: mocks.forSpawnedStdio },
}));

import { copilotEngine, resolveCopilotModel } from "rig";

beforeEach(() => {
  mocks.createSession.mockReset();
  mocks.stop.mockReset();
  mocks.stop.mockResolvedValue([]);
  mocks.createSession.mockResolvedValue({
    sendAndWait: vi.fn(),
    disconnect: vi.fn(),
  });
  mocks.forTcp.mockClear();
  mocks.forSpawnedStdio.mockClear();
  mocks.copilotClientCtor.mockClear();
  delete process.env["COPILOT_SDK_URI"];
  delete process.env["COPILOT_CONNECTION_TOKEN"];
  delete process.env["GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON"];
  delete process.env["COPILOT_SDK_SEND_TIMEOUT_MS"];
  vi.restoreAllMocks();
});

it("attaches to the default TCP endpoint", async () => {
  await copilotEngine()({ model: "gpt-5" });

  expect(mocks.forTcp).toHaveBeenCalledWith("localhost", 7777);
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ mode: "coding-agent", runtime: { kind: "tcp", host: "localhost", port: 7777 } });
  expect(mocks.createSession).toHaveBeenCalledWith({
    model: "gpt-5",
    events: { streaming: false },
    permissions: { onRequest: mocks.approveAll },
  });
});

it.each([
  ["http://127.0.0.1:4141", "127.0.0.1", 4141],
  ["[::1]:4141", "::1", 4141],
  ["tcp://localhost:4242", "localhost", 4242],
])("uses COPILOT_SDK_URI %s", async (uri, host, port) => {
  process.env["COPILOT_SDK_URI"] = uri;

  await copilotEngine()({ model: "gpt-5" });

  expect(mocks.forTcp).toHaveBeenCalledWith(host, port);
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ mode: "coding-agent", runtime: { kind: "tcp", host, port } });
});

it("rejects an unsupported endpoint without echoing embedded credentials", async () => {
  process.env["COPILOT_SDK_URI"] = "https://user:secret@localhost:4141";
  await expect(copilotEngine()({ model: "small" })).rejects.toThrow(/^Invalid Copilot SDK endpoint; expected a plaintext TCP host and port$/);
  expect(mocks.forTcp).not.toHaveBeenCalled();
});

it("uses agentic workflow SDK connection and provider settings", async () => {
  process.env["COPILOT_CONNECTION_TOKEN"] = "connection-token";
  process.env["GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON"] = JSON.stringify({
    model: "claude-sonnet-4.6",
    providers: [{ name: "copilot", baseUrl: "https://provider.example" }],
    models: [{ id: "claude-sonnet-4.6", provider: "copilot" }],
  });

  await copilotEngine()({ model: "small" });

  expect(mocks.forTcp).toHaveBeenCalledWith("localhost", 7777, { connectionToken: "connection-token" });
  expect(mocks.createSession).toHaveBeenCalledWith({
    model: "copilot/claude-sonnet-4.6",
    events: { streaming: false },
    permissions: { onRequest: mocks.approveAll },
    inference: {
      providers: [{ name: "copilot", baseUrl: "https://provider.example" }],
      models: [{ id: "claude-sonnet-4.6", provider: "copilot" }],
    },
  });
});

it("requires an explicit provider when a model alias is ambiguous", () => {
  const models = [{ id: "chat", provider: "first" }, { id: "chat", provider: "second" }];
  expect(() => resolveCopilotModel("chat", models)).toThrow("Ambiguous Copilot model");
  expect(resolveCopilotModel("second/chat", models)).toBe("second/chat");
});

it("uses the configured SDK send timeout", async () => {
  process.env["COPILOT_SDK_SEND_TIMEOUT_MS"] = "120000";
  const sendAndWait = vi.fn().mockResolvedValue({ data: { content: "ok" } });
  mocks.createSession.mockResolvedValue({ sendAndWait, disconnect: vi.fn() });
  const implementation = await copilotEngine()({ model: "small" });

  await implementation.ask("hello");

  expect(sendAndWait).toHaveBeenCalledWith({ prompt: "hello" }, 120000);
});

it("aborts an in-flight SDK request when its signal aborts", async () => {
  const abort = vi.fn();
  const sendAndWait = vi.fn(() => new Promise(() => {}));
  mocks.createSession.mockResolvedValue({ sendAndWait, abort, disconnect: vi.fn() });
  const implementation = await copilotEngine()({ model: "small" });
  const controller = new AbortController();
  const request = implementation.ask("hello", { signal: controller.signal });

  controller.abort(new Error("cancelled"));

  await expect(request).rejects.toThrow("cancelled");
  expect(abort).toHaveBeenCalledOnce();
});

it("surfaces SDK abort failures without an unhandled rejection", async () => {
  const abortError = new Error("abort transport failed");
  const abort = vi.fn().mockRejectedValue(abortError);
  mocks.createSession.mockResolvedValue({
    sendAndWait: vi.fn(() => new Promise(() => {})),
    abort,
    disconnect: vi.fn(),
  });
  const implementation = await copilotEngine()({ model: "small" });
  const controller = new AbortController();
  const request = implementation.ask("hello", { signal: controller.signal });
  const reason = new Error("cancelled");

  controller.abort(reason);

  await expect(request).rejects.toMatchObject({
    message: "Failed to abort agent request",
    errors: [reason, abortError],
  });
});

it("does not return an empty success when the SDK settles during cancellation", async () => {
  let finish: ((value: undefined) => void) | undefined;
  mocks.createSession.mockResolvedValue({
    sendAndWait: vi.fn(() => new Promise<undefined>((resolve) => { finish = resolve; })),
    abort: vi.fn(async () => { finish?.(undefined); }),
    disconnect: vi.fn(),
  });
  const implementation = await copilotEngine()({ model: "small" });
  const controller = new AbortController();
  const request = implementation.ask("hello", { signal: controller.signal });

  controller.abort(new Error("cancelled"));

  await expect(request).rejects.toThrow("cancelled");
});

it("preserves explicit client options", async () => {
  const runtime = { kind: "tcp", host: "127.0.0.1", port: 8765 } as const;

  await copilotEngine({ runtime, workingDirectory: "/tmp/rig", clientInfo: { applicationName: "rig-test" } })({ model: "gpt-5" });

  expect(mocks.forTcp).not.toHaveBeenCalled();
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({
    mode: "coding-agent",
    runtime,
    clientInfo: { applicationName: "rig-test" },
  });
  expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ workingDirectory: "/tmp/rig" }));
});

it("subscribes to all Copilot SDK events and logs JSONL to stderr", async () => {
  const on = vi.fn((handler: (event: unknown) => void) => {
    handler({ type: "session.idle", data: { done: true } });
    return () => {};
  });
  mocks.createSession.mockResolvedValue({ on, sendAndWait: vi.fn() });

  await copilotEngine()({ model: "small" });

  expect(mocks.copilotClientCtor).toHaveBeenCalledTimes(1);
  expect(mocks.createSession).toHaveBeenCalledTimes(1);
});

it("creates one Copilot session per agent implementation", async () => {
  const createAgent = copilotEngine();
  await createAgent({ model: "small" });
  await createAgent({ model: "small" });

  expect(mocks.createSession).toHaveBeenCalledTimes(2);
});

it("uses a stdio connection when server option is true", async () => {
  await copilotEngine({ server: true })({ model: "small" });
  expect(mocks.forSpawnedStdio).toHaveBeenCalledOnce();
  expect(mocks.forTcp).not.toHaveBeenCalled();
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ mode: "coding-agent", runtime: { kind: "spawned-stdio" } });
});

it("maps structured output to the SDK responseSchema option", async () => {
  const sendAndWait = vi.fn().mockResolvedValue({ data: { content: '{"text":"ok"}' } });
  mocks.createSession.mockResolvedValue({ sendAndWait, disconnect: vi.fn() });
  const implementation = await copilotEngine()({ model: "small" });
  const outputSchema = { type: "object", properties: { text: { type: "string" } } };

  await expect(implementation.ask("hello", { outputSchema })).resolves.toBe('{"text":"ok"}');

  expect(sendAndWait).toHaveBeenCalledWith({
    prompt: "hello", responseSchema: { ...outputSchema, additionalProperties: false },
  }, expect.any(Number));
  expect(outputSchema).not.toHaveProperty("additionalProperties");
});

it("closes nested fixed output objects while preserving record schemas", async () => {
  const sendAndWait = vi.fn().mockResolvedValue({ data: { content: "{}" } });
  mocks.createSession.mockResolvedValue({ sendAndWait, disconnect: vi.fn() });
  const implementation = await copilotEngine()({ model: "small" });
  const fixed = { type: "object", properties: { name: { type: "string" } } };
  const record = { type: "object", additionalProperties: { type: "string" } };
  await implementation.ask("hello", {
    outputSchema: {
      type: "object",
      properties: {
        list: { type: "array", items: fixed },
        choice: { anyOf: [fixed, { type: "null" }] },
        record,
      },
    },
  });
  expect(sendAndWait).toHaveBeenCalledWith({
    prompt: "hello",
    responseSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        list: { type: "array", items: { ...fixed, additionalProperties: false } },
        choice: { anyOf: [{ ...fixed, additionalProperties: false }, { type: "null" }] },
        record,
      },
    },
  }, expect.any(Number));
  expect(fixed).not.toHaveProperty("additionalProperties");
});

it("normalizes a string system message to the SDK append configuration", async () => {
  await copilotEngine()({ model: "small", systemMessage: "Be concise." });

  expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({
    systemMessage: { content: "Be concise." },
  }));
});

it("preserves SDK system message configurations", async () => {
  const systemMessage = { mode: "customize" as const, sections: { tone: { action: "append" as const, content: "Be concise." } } };
  await copilotEngine()({ model: "small", systemMessage });

  expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ systemMessage }));
});

it.each([
  [],
  { mode: "invalid" },
  { mode: "replace" },
  { content: 42 },
  { mode: "customize", sections: { tone: { action: "invalid" } } },
])("rejects invalid system message configuration %j before creating a client", async (systemMessage) => {
  await expect(copilotEngine()({ model: "small", systemMessage })).rejects.toThrow("copilotEngine");
  expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
});

it("stops the client when session creation fails", async () => {
  const error = new Error("session creation failed");
  mocks.createSession.mockRejectedValueOnce(error);

  await expect(copilotEngine()({ model: "small" })).rejects.toBe(error);
  expect(mocks.stop).toHaveBeenCalledOnce();
});

it("preserves creation and cleanup failures", async () => {
  const error = new Error("session creation failed");
  const cleanupError = new Error("client stop failed");
  mocks.createSession.mockRejectedValueOnce(error);
  mocks.stop.mockResolvedValueOnce([cleanupError]);

  await expect(copilotEngine()({ model: "small" })).rejects.toMatchObject({
    message: "Failed to create Copilot agent and stop its client",
    errors: [error, cleanupError],
  });
});

it.each([
  "not json",
  "null",
  '{"model":"small","providers":[{"name":"test"}],"models":[]}',
  '{"model":"small","providers":[],"models":[{"id":"test"}]}',
])("reports invalid workflow provider configuration %s", (value) => {
  process.env["GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON"] = value;

  expect(() => copilotEngine()).toThrow();
  expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
});
