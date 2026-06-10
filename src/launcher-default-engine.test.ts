import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const approveAll = vi.fn();
  const createSession = vi.fn();
  const stopClient = vi.fn(async () => []);
  const copilotClientCtor = vi.fn();
  const defaultForUri = () => ({ kind: "uri", url: "localhost:0" });
  const forUri = vi.fn(defaultForUri);
  const CopilotClient = function (this: unknown, options: unknown) {
    copilotClientCtor(options);
    return { createSession, stop: stopClient };
  };
  return { approveAll, createSession, stopClient, copilotClientCtor, defaultForUri, forUri, CopilotClient };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: vi.fn() },
}));

import { agent, launchRigProgram, s } from "rig";

it("uses the launcher cwd when mounting the default copilot engine", async () => {
  const sendAndWait = vi.fn().mockResolvedValue(JSON.stringify("default-mounted"));
  mocks.createSession.mockResolvedValue({ sendAndWait });

  const cwd = "/tmp/workspace/pelikhan/rig/src";
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  await launchRigProgram(fixturePath, { cwd });

  const call = agent({
    name: "launcher-default-engine-test",
    input: s.object({}),
  });
  const result = await call({});
  expect(result).toBe("default-mounted");
  expect(mocks.copilotClientCtor).toHaveBeenCalledWith(expect.objectContaining({ workingDirectory: cwd }));
});

it("uses COPILOT_SDK_URI when mounting the default copilot engine", async () => {
  const sendAndWait = vi.fn().mockResolvedValue(JSON.stringify("env-mounted"));
  mocks.createSession.mockResolvedValue({ sendAndWait });
  process.env["COPILOT_SDK_URI"] = "http://127.0.0.1:4141";
  mocks.forUri.mockImplementation(((url: string) => ({ kind: "uri", url })) as any);

  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  try {
    await launchRigProgram(fixturePath);

    const call = agent({
      name: "launcher-default-engine-uri-test",
      input: s.object({}),
    });
    const result = await call({});
    expect(result).toBe("env-mounted");
    expect(mocks.forUri).toHaveBeenCalledWith("http://127.0.0.1:4141");
    expect(mocks.copilotClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: { kind: "uri", url: "http://127.0.0.1:4141" },
      }),
    );
  } finally {
    delete process.env["COPILOT_SDK_URI"];
    mocks.forUri.mockImplementation(mocks.defaultForUri);
  }
});
