import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, expect, it, vi } from "vitest";

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

  const anthropicConstructor = vi.fn();
  const anthropicToolRunner = vi.fn(() => ({
    async runUntilDone() {
      return { content: [{ type: "text", text: JSON.stringify("anthropic-mounted") }] };
    },
    params: { messages: [] },
  }));
  const Anthropic = function (this: unknown, options: unknown) {
    anthropicConstructor(options);
    return { beta: { messages: { toolRunner: anthropicToolRunner } } };
  };
  const betaTool = vi.fn((tool) => tool);

  const codexConstructor = vi.fn();
  const codexRun = vi.fn(async () => ({ finalResponse: JSON.stringify("codex-mounted") }));
  const codexStartThread = vi.fn(() => ({ run: codexRun }));
  const Codex = function (this: unknown, options: unknown) {
    codexConstructor(options);
    return { startThread: codexStartThread };
  };
  const deepseekConstructor = vi.fn();
  const deepseekRun = vi.fn(async () => ({
    finalResponse: JSON.stringify("deepseek-mounted"),
    events: [{ type: "turn/end", data: { reason: { kind: "completed" } } }],
  }));
  const deepseekSession = vi.fn(() => ({ id: "deepseek-session", run: deepseekRun }));
  const deepseekClose = vi.fn(async () => {});
  const DeepSeekHarness = function (this: unknown, options: unknown) {
    deepseekConstructor(options);
    return { session: deepseekSession, close: deepseekClose };
  };

  return {
    approveAll,
    createSession,
    stopClient,
    copilotClientCtor,
    defaultForUri,
    forUri,
    CopilotClient,
    anthropicConstructor,
    anthropicToolRunner,
    Anthropic,
    betaTool,
    codexConstructor,
    codexRun,
    codexStartThread,
    Codex,
    deepseekConstructor,
    deepseekRun,
    deepseekSession,
    deepseekClose,
    DeepSeekHarness,
  };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: vi.fn() },
}));
vi.mock("@anthropic-ai/sdk", () => ({ default: mocks.Anthropic }));
vi.mock("@anthropic-ai/sdk/helpers/beta/json-schema", () => ({ betaTool: mocks.betaTool }));
vi.mock("@openai/codex-sdk", () => ({ Codex: mocks.Codex }));
vi.mock("@deepseek-ai/dsh-sdk-client", () => ({ DeepSeekHarness: mocks.DeepSeekHarness }));

import { agent, launchRigProgram, s } from "rig";

beforeEach(() => {
  mocks.copilotClientCtor.mockClear();
  mocks.createSession.mockReset();
  mocks.anthropicConstructor.mockClear();
  mocks.anthropicToolRunner.mockClear();
  mocks.betaTool.mockClear();
  mocks.codexConstructor.mockClear();
  mocks.codexRun.mockClear();
  mocks.codexStartThread.mockClear();
  mocks.deepseekConstructor.mockClear();
  mocks.deepseekRun.mockClear();
  mocks.deepseekSession.mockClear();
  mocks.deepseekClose.mockClear();
  delete process.env["COPILOT_SDK_URI"];
  delete process.env["RIG_ENGINE"];
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["OPENAI_API_KEY"];
  delete process.env["GEMINI_API_KEY"];
  delete process.env["GOOGLE_API_KEY"];
  delete process.env["DEEPSEEK_API_KEY"];
});

it("uses the launcher cwd when mounting the default copilot engine", async () => {
  const sendAndWait = vi.fn().mockResolvedValue(JSON.stringify("default-mounted"));
  mocks.createSession.mockResolvedValue({ sendAndWait });

  const cwd = "/tmp/workspace/githubnext/rig/src";
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

it.each(["anthropic", "deepseek"])("prefers COPILOT_SDK_URI over RIG_ENGINE=%s", async (engine) => {
  const sendAndWait = vi.fn().mockResolvedValue(JSON.stringify("copilot-preferred"));
  mocks.createSession.mockResolvedValue({ sendAndWait });
  process.env["COPILOT_SDK_URI"] = "http://127.0.0.1:4242";
  process.env["RIG_ENGINE"] = engine;
  process.env["ANTHROPIC_API_KEY"] = "test-key";
  mocks.forUri.mockImplementation(((url: string) => ({ kind: "uri", url })) as any);

  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  try {
    await launchRigProgram(fixturePath);

    const call = agent({
      name: "launcher-default-engine-copilot-preferred-test",
      input: s.object({}),
    });
    const result = await call({});
    expect(result).toBe("copilot-preferred");
    expect(mocks.forUri).toHaveBeenCalledWith("http://127.0.0.1:4242");
    expect(mocks.copilotClientCtor).toHaveBeenCalled();
    expect(mocks.anthropicConstructor).not.toHaveBeenCalled();
    expect(mocks.deepseekConstructor).not.toHaveBeenCalled();
  } finally {
    mocks.forUri.mockImplementation(mocks.defaultForUri);
  }
});

it("automatically mounts anthropicEngine when ANTHROPIC_API_KEY is set", async () => {
  process.env["ANTHROPIC_API_KEY"] = "test-key";
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  await launchRigProgram(fixturePath);

  const call = agent({
    name: "launcher-default-engine-anthropic-test",
    input: s.object({}),
  });
  const result = await call({});
  expect(result).toBe("anthropic-mounted");
  expect(mocks.anthropicConstructor).toHaveBeenCalledWith({});
  expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
});

it("automatically mounts codexEngine when OPENAI_API_KEY is set", async () => {
  process.env["OPENAI_API_KEY"] = "test-key";
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  await launchRigProgram(fixturePath);

  const call = agent({
    name: "launcher-default-engine-codex-test",
    input: s.object({}),
  });
  const result = await call({});
  expect(result).toBe("codex-mounted");
  expect(mocks.codexConstructor).toHaveBeenCalledWith({});
  expect(mocks.codexStartThread).toHaveBeenCalledWith(expect.objectContaining({ model: "small" }));
  expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
});

it.each(["explicit", "api-key"])("mounts DeepSeek through %s selection with the launcher cwd", async (selection) => {
  if (selection === "explicit") {
    process.env["RIG_ENGINE"] = " DeepSeek ";
    process.env["ANTHROPIC_API_KEY"] = "test-key";
  } else {
    process.env["DEEPSEEK_API_KEY"] = "test-key";
  }
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");
  const cwd = "/tmp/workspace/rig";
  await launchRigProgram(fixturePath, { cwd });
  const call = agent({ name: "launcher-deepseek-test", model: "small", input: s.object({}) });

  await expect(call({})).resolves.toBe("deepseek-mounted");
  expect(mocks.deepseekConstructor).toHaveBeenCalledExactlyOnceWith({
    model: "small",
    cwd,
    processCwd: cwd,
  });
  expect(mocks.deepseekClose).toHaveBeenCalledTimes(1);
  expect(mocks.copilotClientCtor).not.toHaveBeenCalled();
  expect(mocks.anthropicConstructor).not.toHaveBeenCalled();
});

it("preserves existing API-key engine precedence over DeepSeek auto-selection", async () => {
  process.env["ANTHROPIC_API_KEY"] = "test-key";
  process.env["DEEPSEEK_API_KEY"] = "test-key";
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");
  await launchRigProgram(fixturePath);
  const call = agent({ input: s.object({}) });

  await expect(call({})).resolves.toBe("anthropic-mounted");
  expect(mocks.deepseekConstructor).not.toHaveBeenCalled();
});

it("forces Copilot when --server is requested even with DeepSeek configured", async () => {
  process.env["RIG_ENGINE"] = "deepseek";
  process.env["DEEPSEEK_API_KEY"] = "test-key";
  mocks.createSession.mockResolvedValue({
    sendAndWait: vi.fn().mockResolvedValue(JSON.stringify("copilot-mounted")),
  });
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");
  await launchRigProgram(fixturePath, { startServer: true });
  const call = agent({ input: s.object({}) });

  await expect(call({})).resolves.toBe("copilot-mounted");
  expect(mocks.deepseekConstructor).not.toHaveBeenCalled();
});
