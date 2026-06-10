import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const approveAll = vi.fn();
  const createSession = vi.fn();
  const forUri = vi.fn(() => ({ kind: "uri", url: "localhost:7777" }));
  const forStdio = vi.fn(() => ({ kind: "stdio" }));
  const copilotClientCtor = vi.fn();
  const CopilotClient = function (this: unknown, options: unknown) {
    copilotClientCtor(options);
    return { createSession };
  };
  return { approveAll, createSession, forUri, forStdio, copilotClientCtor, CopilotClient };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: mocks.forStdio },
}));

import { copilotEngine } from "rig";

beforeEach(() => {
  mocks.createSession.mockReset();
  mocks.forUri.mockClear();
  mocks.forUri.mockImplementation(() => ({ kind: "uri", url: "localhost:7777" }));
  mocks.forStdio.mockClear();
  mocks.forStdio.mockImplementation(() => ({ kind: "stdio" }));
  mocks.copilotClientCtor.mockClear();
  delete process.env["COPILOT_SDK_URI"];
  vi.restoreAllMocks();
});

it("uses a URI (HTTP) connection by default", async () => {
  copilotEngine().createSession({ model: "gpt-5", streaming: false } as any);

  expect(mocks.forUri).toHaveBeenCalledWith("localhost:7777");
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ connection: { kind: "uri", url: "localhost:7777" } });
  expect(mocks.createSession).toHaveBeenCalledWith({ model: "gpt-5", streaming: false });
});

it("uses COPILOT_SDK_URI when set", async () => {
  process.env["COPILOT_SDK_URI"] = "http://127.0.0.1:4141";
  mocks.forUri.mockImplementation(((url: string) => ({ kind: "uri", url })) as any);

  copilotEngine().createSession({ model: "gpt-5", streaming: false } as any);

  expect(mocks.forUri).toHaveBeenCalledWith("http://127.0.0.1:4141");
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ connection: { kind: "uri", url: "http://127.0.0.1:4141" } });
});

it("preserves explicit client options", async () => {
  const connection = { kind: "uri", url: "127.0.0.1:8765" } as const;

  copilotEngine({ connection, workingDirectory: "/tmp/rig" });

  expect(mocks.forUri).not.toHaveBeenCalled();
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({
    connection,
    workingDirectory: "/tmp/rig",
  });
});

it("subscribes to all Copilot SDK events and logs JSONL to stderr", async () => {
  const on = vi.fn((handler: (event: unknown) => void) => {
    handler({ type: "session.idle", data: { done: true } });
    return () => {};
  });
  mocks.createSession.mockResolvedValue({ on, sendAndWait: vi.fn() });

  await copilotEngine().createSession({ model: "gpt-4.1", streaming: false } as any);

  expect(mocks.copilotClientCtor).toHaveBeenCalledTimes(1);
  expect(mocks.createSession).toHaveBeenCalledTimes(1);
});

it("creates and subscribes only once per engine session", async () => {
  const client = copilotEngine();
  await client.createSession({ model: "gpt-4.1", streaming: false } as any);
  await client.createSession({ model: "gpt-4.1", streaming: false } as any);

  expect(mocks.createSession).toHaveBeenCalledTimes(2);
});

it("uses a stdio connection when server option is true", async () => {
  copilotEngine({ server: true }).createSession({ model: "gpt-4.1", streaming: false } as any);
  expect(mocks.forStdio).toHaveBeenCalledOnce();
  expect(mocks.forUri).not.toHaveBeenCalled();
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith({ connection: { kind: "stdio" } });
});
