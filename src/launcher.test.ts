import { beforeEach, expect, it, vi } from "vitest";
import { resolve, dirname } from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const mocks = vi.hoisted(() => {
  const approveAll = vi.fn();
  let sendAndWaitImpl: () => unknown | Promise<unknown> = async () => JSON.stringify("done");
  const disconnectSession = vi.fn(async () => {});
  const stopClient = vi.fn(async () => []);
  const createSession = vi.fn(async () => ({
    sendAndWait: async () => {
      const response = await sendAndWaitImpl();
      return typeof response === "string" ? response : JSON.stringify(response);
    },
    disconnect: disconnectSession,
  }));
  const forUri = vi.fn(() => ({ kind: "uri", url: "localhost:7777" }));
  const forStdio = vi.fn(() => ({ kind: "stdio" }));
  const copilotClientCtor = vi.fn();
  const CopilotClient = function (this: unknown, options: unknown) {
    copilotClientCtor(options);
    return { createSession, stop: stopClient };
  };
  const setSendAndWaitImpl = (impl: () => unknown | Promise<unknown>) => {
    sendAndWaitImpl = impl;
  };
  return { approveAll, createSession, disconnectSession, stopClient, forUri, forStdio, copilotClientCtor, CopilotClient, setSendAndWaitImpl };
});

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: mocks.CopilotClient,
  RuntimeConnection: { forUri: mocks.forUri, forStdio: mocks.forStdio },
}));

import { agent, s } from "rig";
import { launchRigProgram, runLauncherCli } from "rig";

beforeEach(() => {
  mocks.createSession.mockClear();
  mocks.forUri.mockClear();
  mocks.forStdio.mockClear();
  mocks.copilotClientCtor.mockClear();
  mocks.disconnectSession.mockClear();
  mocks.stopClient.mockClear();
  mocks.setSendAndWaitImpl(async () => JSON.stringify("done"));
});

async function runCliAndCaptureStdout(argv: string[], stdinChunks: string[] = [""]): Promise<string> {
  const stdin = Readable.from(stdinChunks);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });
  await runLauncherCli(argv, {}, { stdin, stdout });
  return output.join("");
}

it("loads a rig program and mounts a copilot client", async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const globalState = globalThis as { __launcherLoaded?: number };
  const before = globalState.__launcherLoaded ?? 0;
  const fixturePath = resolve(__dirname, "./launcher.fixture.ts");

  mocks.setSendAndWaitImpl(async () => JSON.stringify("mounted"));
  await launchRigProgram(fixturePath);

  expect(globalState.__launcherLoaded).toBe(before + 1);

  const call = agent({
    name: "launcher-test",
    input: s.object({}),
  });
  const result = await call({});
  expect(result).toBe("mounted");
});

it("uses stdin mode by default and writes the final answer to stdout", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([fixturePath], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("supports stdin mode for string input/output root agents", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-string.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  mocks.setSendAndWaitImpl(async () => JSON.stringify("done"));
  await runLauncherCli([fixturePath], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("supports stdin mode when root default export is a string", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-default-string.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  mocks.setSendAndWaitImpl(async () => JSON.stringify("done"));
  await runLauncherCli([fixturePath], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("supports stdin mode when root default export is a prompt builder", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-default-prompt.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  mocks.setSendAndWaitImpl(async () => JSON.stringify("done"));
  await runLauncherCli([fixturePath], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("supports stdin mode for JSON input and JSON stdout output", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-json.fixture.ts");
  const stdin = Readable.from(["{\"message\":\"hello\"}"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  mocks.setSendAndWaitImpl(async () => ({ ok: true }));
  await runLauncherCli([fixturePath], {}, { stdin, stdout });

  expect(output.join("")).toBe("{\"ok\":true}");
});

it("rejects stdin mode when root agent expects JSON input but stdin is not JSON", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-json.fixture.ts");
  const stdin = Readable.from(["not-json"]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(
    runLauncherCli([fixturePath], {}, { stdin, stdout }),
  ).rejects.toThrow("Expected stdin to contain JSON for the root agent input schema.");
});

it("requires stdin-mode root agent to be a default export", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin-named-root.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(
    runLauncherCli([fixturePath], {}, { stdin, stdout }),
  ).rejects.toThrow("Expected program to export a root value (agent, string, or prompt builder) as default export.");
});

it("rejects stdin mode when prompt is empty", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin.fixture.ts");
  const stdin = Readable.from(["   \n\t"]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  await expect(
    runLauncherCli([fixturePath], {}, { stdin, stdout }),
  ).rejects.toThrow(/<program-file>/);
});

it("rejects unknown cli arguments", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.fixture.ts");

  await expect(runLauncherCli([fixturePath, "--file"])).rejects.toThrow(
    /<program-file>/,
  );
});

it("prints launcher help for common help invocations", async () => {
  for (const argv of [["--help"], ["-h"], ["help"], ["/help"], ["/?"]]) {
    const output = await runCliAndCaptureStdout(argv);
    expect(output).toContain("Usage:");
    expect(output).toContain("[<program-file>]");
  }
  expect(mocks.createSession).not.toHaveBeenCalled();
});

it("accepts --server flag without rejecting", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([fixturePath, "--server"], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
  expect(mocks.forStdio).toHaveBeenCalled();
});

it("accepts --typecheck flag without rejecting", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin.fixture.ts");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([fixturePath, "--typecheck"], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("falls back to the skill tsconfig when cwd tsconfig is missing", async () => {
  const fixturePath = resolve(dirname(fileURLToPath(import.meta.url)), "./launcher.stdin.fixture.ts");
  const skillDirCwd = resolve(dirname(fileURLToPath(import.meta.url)), "../skills/rig");
  const stdin = Readable.from(["Review this patch"]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([fixturePath, "--typecheck"], { cwd: skillDirCwd }, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("rejects --typecheck when inline program fails typecheck", async () => {
  const stdin = Readable.from([`
const root = agent({
  name: "launcher-stdin-program",
  instructions: 42,
});
export default root;
`]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(runLauncherCli(["--typecheck"], {}, { stdin, stdout })).rejects.toThrow(
    /Typecheck failed/,
  );
});

it("rejects --typecheck when program file fails typecheck before execution", async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), "rig-launcher-test-"));
  const fixturePath = resolve(tempDir, "typecheck-fail.ts");
  await writeFile(
    fixturePath,
    `
import { agent, s } from "rig";
const shouldBeString: string = 42;
void shouldBeString;
const root = agent({
  name: "launcher-typecheck-fail",
});
export default root;
`,
    "utf8",
  );
  try {
    const stdin = Readable.from(["Review this patch"]);
    const stdout = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    await expect(runLauncherCli([fixturePath, "--typecheck"], {}, { stdin, stdout })).rejects.toThrow(
      /Typecheck failed/,
    );
    expect(mocks.createSession).not.toHaveBeenCalled();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

it("runs an inlined stdin program by invoking the default no-input root agent", async () => {
  const stdin = Readable.from([`
const root = agent({
  name: "launcher-stdin-program",
  instructions: "Write a short note.",
});
export default root;
`]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("runs an inlined stdin program by defaulting to the first agent assignment", async () => {
  const stdin = Readable.from([`
const reviewer = agent({
  name: "launcher-stdin-program",
  instructions: "Write a short note.",
});
`]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("runs an inlined stdin program when default export is a string", async () => {
  const stdin = Readable.from([`
export default "Write a short note.";
`]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("runs an inlined stdin program when default export is a prompt builder", async () => {
  const stdin = Readable.from([`
export default p\`Write a short note about \${p.read("README.md")}.\`;
`]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("rejects an inlined stdin program when the root agent requires input", async () => {
  const stdin = Readable.from([`
const root = agent({
  name: "launcher-stdin-program-with-input",
  input: s.object({ message: s.string }),
});
export default root;
`]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(runLauncherCli([], {}, { stdin, stdout })).rejects.toThrow(
    "Expected stdin program root agent to have no input (omit input or use input: s.object({})).",
  );
});

it("uses the first agent assignment as inline stdin root when no default export exists", async () => {
  const stdin = Readable.from([`
const first = agent({
  name: "launcher-stdin-program-with-input",
  input: s.object({ message: s.string }),
});
const second = agent({
  name: "launcher-stdin-program-no-input",
});
`]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(runLauncherCli([], {}, { stdin, stdout })).rejects.toThrow(
    "Expected stdin program root agent to have no input (omit input or use input: s.object({})).",
  );
});

it("uses the first no-input agent assignment as inline stdin root when no default export exists", async () => {
  const stdin = Readable.from([`
const first = agent({
  name: "launcher-stdin-program-no-input",
});
const second = agent({
  name: "launcher-stdin-program-with-input",
  input: s.object({ message: s.string }),
});
`]);
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });

  await runLauncherCli([], {}, { stdin, stdout });

  expect(output.join("")).toBe("done");
});

it("requires a non-empty stdin program when no program path is provided", async () => {
  const stdin = Readable.from(["  \n\t"]);
  const stdout = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

  await expect(runLauncherCli([], {}, { stdin, stdout })).rejects.toThrow(
    /<program-file>/,
  );
});
