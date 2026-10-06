import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFixtureLauncher, createFixtureServer } from "../.github/drivers/codex-fixture-mcp.ts";
import { criteria, dummyRequest } from "../.github/fixtures/three-judges.ts";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(),
}));
vi.mock("node:child_process", async original => ({
  ...await original<typeof import("node:child_process")>(), spawn: mocks.spawn,
}));
vi.mock("node:fs/promises", async original => ({
  ...await original<typeof import("node:fs/promises")>(), readFile: mocks.readFile, writeFile: mocks.writeFile,
}));
const result = {
  engine: "codex", model: "gpt-5.3-codex", request: dummyRequest, modelCalls: 3, verdict: "approve",
  judgments: criteria.map(criterion => ({ criterion, decision: "approve", reason: "Harmless and practical." })),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readFile.mockResolvedValue("Installed skill");
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(),
    });
    child.stdin.on("data", (chunk: Buffer) => expect(chunk.toString()).toBe("{}\n"));
    queueMicrotask(() => {
      child.stdout.write(JSON.stringify(result));
      child.emit("close", 0);
    });
    return child;
  });
});
afterEach(() => vi.unstubAllEnvs());

it("runs only the checked-in fixture and persists independently validated output", async () => {
  vi.stubEnv("GITHUB_TOKEN", "upstream-secret");
  vi.stubEnv("CODEX_API_KEY", "upstream-key");
  vi.stubEnv("COPILOT_CONNECTION_TOKEN", "connection-secret");
  const launch = createFixtureLauncher("/checkout", "/output.json");
  expect(await launch()).toEqual(result);
  expect(mocks.readFile.mock.calls.map(([path]) => path)).toEqual([
    "/checkout/.codex/skills/rig/SKILL.md",
    "/checkout/.codex/skills/rig/runtime.md",
    "/checkout/.codex/skills/rig/engines.md",
  ]);
  const [command, args, options] = mocks.spawn.mock.calls[0]!;
  expect(command).toBe(process.execPath);
  expect(args).toEqual(["skills/rig/run.ts", ".github/fixtures/provider-three-judges.ts"]);
  expect(options.cwd).toBe("/checkout");
  expect(options.env).toMatchObject({
    CODEX_API_KEY: "awf-proxy", CODEX_HOME: "/tmp/gh-aw/mcp-config",
    GH_AW_MODEL_AGENT_CODEX: "gpt-5.3-codex", RIG_JUDGE_ENGINE: "codex",
  });
  for (const name of ["GITHUB_TOKEN", "COPILOT_CONNECTION_TOKEN", "COPILOT_GITHUB_TOKEN", "OPENAI_API_KEY", "RIG_FIXTURE_MCP_TOKEN"]) {
    expect(options.env[name]).toBeUndefined();
  }
  expect(mocks.writeFile).toHaveBeenCalledWith("/output.json", JSON.stringify(result), { encoding: "utf8", flag: "wx" });
  await expect(launch()).rejects.toThrow("only be launched once");
  expect(mocks.spawn).toHaveBeenCalledOnce();
});

it("fails missing skill prerequisites without launching or allowing a retry", async () => {
  mocks.readFile.mockRejectedValueOnce(new Error("Missing installed skill"));
  const launch = createFixtureLauncher("/checkout", "/output.json");
  await expect(launch()).rejects.toThrow("Missing installed skill");
  await expect(launch()).rejects.toThrow("only be launched once");
  expect(mocks.spawn).not.toHaveBeenCalled();
  expect(mocks.writeFile).not.toHaveBeenCalled();
});

it.each(["exit", "invalid-json", "invalid-result"])("does not persist failed fixture output: %s", async failure => {
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(),
    });
    queueMicrotask(() => {
      child.stdout.write(failure === "invalid-json" ? "not JSON" : JSON.stringify({ ...result, modelCalls: 4 }));
      child.stderr.write("Gateway unavailable");
      child.emit("close", failure === "exit" ? 1 : 0);
    });
    return child;
  });
  const launch = createFixtureLauncher("/checkout", "/output.json");
  await expect(launch()).rejects.toThrow();
  await expect(launch()).rejects.toThrow("only be launched once");
  expect(mocks.writeFile).not.toHaveBeenCalled();
});

it("requires authentication and rejects arbitrary tools and fixture arguments", async () => {
  const launch = vi.fn().mockResolvedValue(result);
  const server = createFixtureServer("test-token", launch);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP server address");
  const url = `http://127.0.0.1:${address.port}/mcp`;
  const call = async (method: string, params = {}, authorized = true) => await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorized && { Authorization: "Bearer test-token" }) },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  try {
    expect((await call("tools/call", { name: "run_rig" }, false)).status).toBe(401);
    expect(await (await call("initialize")).json()).toMatchObject({ result: { capabilities: { tools: {} } } });
    expect(await (await call("tools/list")).json()).toMatchObject({
      result: { tools: [{ name: "run_rig", inputSchema: { additionalProperties: false } }] },
    });
    for (const params of [{ name: "bash" }, { name: "run_rig", arguments: { source: "arbitrary" } }]) {
      expect(await (await call("tools/call", params)).json()).toHaveProperty("error");
    }
    expect(launch).not.toHaveBeenCalled();
    expect(await (await call("tools/call", { name: "run_rig", arguments: {} })).json()).toMatchObject({
      result: { content: [{ type: "text", text: JSON.stringify(result) }] },
    });
    expect(launch).toHaveBeenCalledOnce();
    launch.mockRejectedValueOnce(new Error("Fixture failed"));
    expect(await (await call("tools/call", { name: "run_rig" })).json()).toMatchObject({
      result: { isError: true, content: [{ text: "Fixture failed" }] },
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
