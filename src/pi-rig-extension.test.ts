import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import piRigExtension, { createPiRigTool } from "../.github/drivers/pi-rig-extension.ts";
import { criteria, dummyRequest } from "../.github/fixtures/three-judges.ts";

const directories: string[] = [];
const validResult = {
  engine: "pi", model: "gpt-5.3-codex", request: dummyRequest, modelCalls: 3, verdict: "approve",
  judgments: criteria.map(criterion => ({ criterion, decision: "approve", reason: "Harmless and practical." })),
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fixture(source: string, timeoutMs?: number) {
  const cwd = await mkdtemp(join(tmpdir(), "pi-rig-tool-test-"));
  directories.push(cwd);
  await mkdir(join(cwd, "skills/rig"), { recursive: true });
  await mkdir(join(cwd, ".github/fixtures"), { recursive: true });
  await writeFile(join(cwd, "skills/rig/run.ts"), source);
  await writeFile(join(cwd, ".github/fixtures/provider-three-judges.ts"), "");
  const options = {
    cwd, agentDir: join(cwd, "pi-agent"), outputPath: join(cwd, "result.json"),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
  return { options, tool: createPiRigTool(options) };
}

it("runs only the fixed fixture without a shell or credential environment", async () => {
  vi.stubEnv("COPILOT_CONNECTION_TOKEN", "secret-connection-token");
  vi.stubEnv("OPENAI_API_KEY", "secret-provider-key");
  vi.stubEnv("RIG_JUDGE_ENGINE", "gemini");
  const { tool, options } = await fixture(`
import { readFileSync } from "node:fs";
process.stdout.write(JSON.stringify({
  ...${JSON.stringify(validResult)},
  probe: {
    input: readFileSync(0, "utf8"),
    argv: process.argv.slice(2),
    engine: process.env.RIG_JUDGE_ENGINE,
    agentDir: process.env.PI_CODING_AGENT_DIR,
    connectionToken: process.env.COPILOT_CONNECTION_TOKEN ?? null,
    providerKey: process.env.OPENAI_API_KEY ?? null,
  },
}));
`);
  const result = await tool.execute("first", {});
  expect(result.details).toMatchObject({
    ...validResult,
    probe: {
      input: "{}\n", argv: [join(options.cwd, ".github/fixtures/provider-three-judges.ts")],
      engine: "pi", agentDir: options.agentDir, connectionToken: null, providerKey: null,
    },
  });
  expect(JSON.parse(await readFile(options.outputPath, "utf8"))).toEqual(result.details);
  expect((await stat(options.outputPath)).mode & 0o777).toBe(0o600);
  expect(result.content).toEqual([{ type: "text", text: JSON.stringify(result.details) }]);
  expect(tool.parameters).toMatchObject({ properties: {}, additionalProperties: false });
  await expect(tool.execute("second", {})).rejects.toThrow("only be launched once");
});

it("registers a direct tool without starting a process", () => {
  vi.stubEnv("GITHUB_WORKSPACE", "/test-workspace");
  vi.stubEnv("PI_CODING_AGENT_DIR", "/test-agent");
  const registerTool = vi.fn();
  piRigExtension({ registerTool });
  expect(registerTool).toHaveBeenCalledOnce();
  expect(registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: "run_rig", parameters: expect.objectContaining({ properties: {} }) }));
});

it("requires harness-owned workspace and gateway settings", () => {
  vi.stubEnv("GITHUB_WORKSPACE", "");
  expect(() => piRigExtension({ registerTool: vi.fn() })).toThrow("are required");
});

it("rejects model-supplied execution settings without allowing a retry", async () => {
  const { tool } = await fixture('throw new Error("Must not run");');
  await expect(tool.execute("first", { source: "untrusted", command: "node", model: "other" })).rejects.toThrow("takes no arguments");
  await expect(tool.execute("second", {})).rejects.toThrow("only be launched once");
});

it("claims the single launch before concurrent invocations can race", async () => {
  const { tool } = await fixture(`setTimeout(() => process.stdout.write(${JSON.stringify(JSON.stringify(validResult))}), 100);`);
  const first = tool.execute("first", {});
  await expect(tool.execute("second", {})).rejects.toThrow("only be launched once");
  await expect(first).resolves.toMatchObject({ details: validResult });
});

it.each([
  "not JSON",
  JSON.stringify({ ...validResult, modelCalls: 4 }),
  JSON.stringify({ ...validResult, model: "auto" }),
  JSON.stringify({ ...validResult, judgments: [] }),
])("does not persist invalid fixture output: %s", async output => {
  const { tool, options } = await fixture(`process.stdout.write(${JSON.stringify(output)});`);
  await writeFile(options.outputPath, JSON.stringify(validResult));
  await expect(tool.execute("first", {})).rejects.toThrow();
  await expect(readFile(options.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(tool.execute("second", {})).rejects.toThrow("only be launched once");
});

it("surfaces child errors and removes stale successful results", async () => {
  const { tool, options } = await fixture('console.error("Gateway unavailable"); process.exitCode = 1;');
  await writeFile(options.outputPath, JSON.stringify(validResult));
  await expect(tool.execute("first", {})).rejects.toThrow("Gateway unavailable");
  await expect(readFile(options.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("terminates a timed-out child without persisting a result", async () => {
  const { tool, options } = await fixture("setInterval(() => {}, 1000);", 100);
  await expect(tool.execute("first", {})).rejects.toThrow("Rig fixture failed");
  await expect(readFile(options.outputPath)).rejects.toMatchObject({ code: "ENOENT" });
});

it("propagates active cancellation to the child", async () => {
  const { tool } = await fixture("setInterval(() => {}, 1000);");
  const controller = new AbortController();
  const invocation = tool.execute("first", {}, controller.signal);
  setTimeout(() => controller.abort(), 100);
  await expect(invocation).rejects.toThrow("aborted");
});

it("rejects a pre-aborted invocation before spawning", async () => {
  const { tool } = await fixture('throw new Error("Must not run");');
  await expect(tool.execute("first", {}, AbortSignal.abort())).rejects.toThrow();
  await expect(tool.execute("second", {})).rejects.toThrow("only be launched once");
});

it.each(["stdout", "stderr"])("terminates a child exceeding the %s limit", async stream => {
  const { tool } = await fixture(`process.${stream}.write("x".repeat(1024 * 1024 + 1)); setInterval(() => {}, 1000);`);
  await expect(tool.execute("first", {})).rejects.toThrow("maxBuffer");
});

it("rejects invalid timeout configuration", () => {
  expect(() => createPiRigTool({ cwd: "/test", agentDir: "/agent", outputPath: "/result", timeoutMs: 0 })).toThrow("must be positive");
});
