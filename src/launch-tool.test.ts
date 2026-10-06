import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRigLaunchTool } from "rig/launch-tool";

const temporaryDirs: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fixture(source: string, timeoutMs?: number) {
  const cwd = await mkdtemp(join(tmpdir(), "rig-launch-tool-test-"));
  temporaryDirs.push(cwd);
  const launcherPath = join(cwd, "launcher.mjs");
  await writeFile(launcherPath, source);
  return createRigLaunchTool({
    uri: "http://localhost:4242", connectionToken: "pipe-test-token", cwd, launcherPath,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
}

function invoke(tool: ReturnType<typeof createRigLaunchTool>, source: string) {
  return tool.handler({ source }, { sessionId: "test", toolCallId: "test-call", toolName: tool.name, arguments: { source } });
}

it("passes source on stdin and credentials only on the dedicated descriptor", async () => {
  const tool = await fixture(`
import { readFileSync } from "node:fs";
const connection = JSON.parse(readFileSync(3, "utf8"));
process.stdout.write(JSON.stringify({
  source: readFileSync(0, "utf8"),
  uri: connection.uri,
  correctToken: connection.connectionToken === "pipe-test-token",
  tokenEnvPresent: !!process.env.COPILOT_CONNECTION_TOKEN,
  uriEnvPresent: !!process.env.COPILOT_SDK_URI,
  argv: process.argv.slice(2),
}));
`);
  const result = await invoke(tool, 'export default "test";');
  expect(JSON.parse(String(result))).toEqual({
    source: 'export default "test";',
    uri: "http://localhost:4242",
    correctToken: true,
    tokenEnvPresent: false,
    uriEnvPresent: false,
    argv: ["--connection-fd=3"],
  });
  expect(tool.parameters).toMatchObject({ required: ["source"], additionalProperties: false });
  expect(JSON.stringify(tool.parameters)).not.toContain("connectionToken");
});

it("reports subprocess errors and redacts the connection token", async () => {
  const tool = await fixture(`
import { readFileSync } from "node:fs";
const { connectionToken } = JSON.parse(readFileSync(3, "utf8"));
readFileSync(0);
console.error("Connection failed: " + connectionToken);
process.exitCode = 1;
`);
  await expect(invoke(tool, "test"))
    .rejects.toThrow("Rig launch failed (1): Connection failed: [redacted]");
});

it("terminates a stalled launcher and reports a timeout", async () => {
  const tool = await fixture("setInterval(() => {}, 1000);", 100);
  await expect(invoke(tool, "test")).rejects.toThrow("Rig launch timed out");
});

it("rejects empty source before launching", async () => {
  const tool = await fixture('throw new Error("Must not launch");');
  await expect(invoke(tool, " ")).rejects.toThrow("nonempty TypeScript source");
});

it("terminates a launcher that exceeds the output limit", async () => {
  const tool = await fixture(`
import { readFileSync } from "node:fs";
readFileSync(3);
readFileSync(0);
process.stdout.write("x".repeat(1024 * 1024 + 1));
setInterval(() => {}, 1000);
`);
  await expect(invoke(tool, "test")).rejects.toThrow("output exceeds 1 MiB");
});

it("redacts a token echoed on stdout", async () => {
  const tool = await fixture(`
import { readFileSync } from "node:fs";
const { connectionToken } = JSON.parse(readFileSync(3, "utf8"));
readFileSync(0);
process.stdout.write(connectionToken);
`);
  await expect(invoke(tool, "test")).resolves.toBe("[redacted]");
});
