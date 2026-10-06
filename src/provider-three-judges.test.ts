import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWorkflow } from "rig";
import { assertThreeJudges } from "../.github/fixtures/assert-three-judges.ts";
import { createProviderFixture } from "../.github/fixtures/provider-fixture.ts";

const mocks = vi.hoisted(() => ({
  judge: vi.fn(),
  run: vi.fn(),
  startThread: vi.fn(),
  codex: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("@openai/codex-sdk", () => ({
  Codex: function (options: unknown) {
    mocks.codex(options);
    return { startThread: mocks.startThread };
  },
}));
vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal<typeof import("node:child_process")>(),
  spawn: mocks.spawn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RIG_JUDGE_ENGINE", "codex");
  vi.stubEnv("CODEX_HOME", "/test/harness-codex");
  vi.stubEnv("GH_AW_MODEL_AGENT_CODEX", "gpt-5.3-codex");
  vi.stubEnv("GEMINI_API_BASE_URL", "http://test-gemini-proxy");
  vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
  mocks.judge.mockReset();
  mocks.judge.mockReturnValue('{"decision":"approve","reason":"Harmless and practical."}');
  mocks.run.mockImplementation(async () => ({ finalResponse: mocks.judge() }));
  mocks.startThread.mockReturnValue({ run: mocks.run });
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
      kill: vi.fn(),
    });
    queueMicrotask(() => {
      child.stdout.write(JSON.stringify({ session_id: "test-session", response: mocks.judge() }));
      child.emit("close", 0);
    });
    return child;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(["codex", "gemini"])("%s three-judge fixture", engine => {
  it("runs three real Rig calls through the selected adapter and validates the result", async () => {
    vi.stubEnv("RIG_JUDGE_ENGINE", engine);
    const result = await runWorkflow(createProviderFixture());
    assertThreeJudges(result, engine);
    expect(mocks.judge).toHaveBeenCalledTimes(3);
    if (engine === "codex") {
      expect(mocks.codex).toHaveBeenCalledTimes(3);
      expect(mocks.spawn).not.toHaveBeenCalled();
      for (const [options] of mocks.startThread.mock.calls) {
        expect(options).toMatchObject({ model: "gpt-5.3-codex", sandboxMode: "read-only", approvalPolicy: "never" });
      }
      for (const [index, [prompt, options]] of mocks.run.mock.calls.entries()) {
        expect(prompt).toContain(["clarity", "safety", "feasibility"][index]);
        expect(options.outputSchema.properties.decision.enum).toEqual(["approve", "reject"]);
        expect(options.outputSchema.additionalProperties).toBe(false);
      }
      for (const [options] of mocks.codex.mock.calls) {
        expect(options).toEqual({ config: {
          mcp_servers: { safeoutputs: { enabled: false }, "rig-fixture": { enabled: false } },
          web_search: "disabled",
        } });
      }
    } else {
      expect(mocks.codex).not.toHaveBeenCalled();
      expect(mocks.spawn).toHaveBeenCalledTimes(3);
      for (const [index, [command, args, options]] of mocks.spawn.mock.calls.entries()) {
        expect(command).toBe("gemini");
        expect(args).toContain("gemini-2.5-flash");
        expect(args).toContain("plan");
        expect(args).toContain("none");
        expect(args[args.indexOf("--prompt") + 1]).toContain(["clarity", "safety", "feasibility"][index]);
        expect(options.env["GEMINI_API_BASE_URL"]).toBe("http://test-gemini-proxy");
      }
    }
  });

  it("computes a majority with one dissent and no fourth call", async () => {
    vi.stubEnv("RIG_JUDGE_ENGINE", engine);
    mocks.judge.mockReturnValueOnce('{"decision":"reject","reason":"One dissent."}');
    assertThreeJudges(await runWorkflow(createProviderFixture()), engine);
    expect(mocks.judge).toHaveBeenCalledTimes(3);
  });

  it.each([
    "not JSON",
    '{"decision":"maybe","reason":"Invalid."}',
    '{"decision":"approve","reason":"   "}',
    '{"decision":"approve"}',
  ])("fails invalid output without retries: %s", async response => {
    vi.stubEnv("RIG_JUDGE_ENGINE", engine);
    mocks.judge.mockReturnValue(response);
    await expect(runWorkflow(createProviderFixture())).rejects.toThrow("Missing or invalid clarity judgment");
    expect(mocks.judge).toHaveBeenCalledOnce();
  });

  it("fails a majority rejection after exactly three calls", async () => {
    vi.stubEnv("RIG_JUDGE_ENGINE", engine);
    mocks.judge.mockReturnValue('{"decision":"reject","reason":"Rejected."}');
    await expect(runWorkflow(createProviderFixture())).rejects.toThrow("Dummy request integration failed");
    expect(mocks.judge).toHaveBeenCalledTimes(3);
  });
});

it("surfaces provider errors without retries", async () => {
  mocks.run.mockRejectedValueOnce(new Error("Gateway unavailable"));
  await expect(runWorkflow(createProviderFixture())).rejects.toThrow("Missing or invalid clarity judgment");
  expect(mocks.run).toHaveBeenCalledOnce();
});

it.each(["RIG_JUDGE_ENGINE", "CODEX_HOME", "GH_AW_MODEL_AGENT_CODEX"])("requires %s rather than falling back to Copilot", name => {
  vi.stubEnv(name, "");
  expect(() => createProviderFixture()).toThrow(`${name} is required`);
  expect(mocks.codex).not.toHaveBeenCalled();
});

it("rejects unsupported adapters, including the deferred Claude variant", () => {
  vi.stubEnv("RIG_JUDGE_ENGINE", "claude");
  expect(() => createProviderFixture()).toThrow("Unsupported three-judge engine: claude");
});

it.each(["codex", "gemini", "pi"])("declares the %s workflow's provider and shared fixture contract", engine => {
  const markdown = readFileSync(new URL(`../.github/workflows/rig-skill-integration-${engine}.md`, import.meta.url), "utf8");
  const shared = readFileSync(new URL("../.github/workflows/shared/rig-three-judges.md", import.meta.url), "utf8");
  const lock = readFileSync(new URL(`../.github/workflows/rig-skill-integration-${engine}.lock.yml`, import.meta.url), "utf8");
  expect(markdown).toContain(`id: ${engine}`);
  expect(markdown).toContain(`RIG_JUDGE_ENGINE: ${engine}`);
  expect(markdown).toContain("shared/rig-three-judges.md");
  expect(markdown).toContain("schedule: daily");
  expect(markdown).toContain("workflow_dispatch:");
  expect(markdown).toContain("strict: true");
  expect(markdown).toContain("skills:\n  - skills/rig");
  expect(shared).toContain("run: npm ci");
  expect(shared).toContain("node skills/rig/run.ts .github/fixtures/provider-three-judges.ts >");
  expect(shared).toContain("run: node .github/fixtures/assert-three-judges.ts");
  expect(shared).toContain("Never fabricate\nresults or call `noop` on failure");
  expect(lock).toContain("assert-three-judges.ts");
  if (engine !== "gemini") {
    expect(markdown).toContain(`model: copilot/${engine === "codex" ? "gpt-5.3-codex" : "auto"}`);
    expect(markdown).toContain("copilot-requests: write");
    expect(lock).toContain("COPILOT_GITHUB_TOKEN: ${{ github.token }}");
    expect(lock).not.toContain("secrets.OPENAI_API_KEY");
  } else {
    expect(lock).toContain("GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}");
    expect(lock).toContain("GEMINI_API_BASE_URL:");
  }
});

it("preserves non-secret Codex fixture settings across shell filtering", () => {
  const lock = readFileSync(new URL("../.github/workflows/rig-skill-integration-codex.lock.yml", import.meta.url), "utf8");
  expect(lock).toContain('"set":{"CODEX_API_KEY":"awf-proxy","CODEX_HOME":"/tmp/gh-aw/mcp-config","GH_AW_MODEL_AGENT_CODEX":"gpt-5.3-codex","RIG_JUDGE_ENGINE":"codex"}');
  expect(lock).toContain("GH_AW_MODEL_AGENT_CODEX: gpt-5.3-codex");
});

it("uses a declared fixture-only MCP driver instead of Codex's unsupported native shell", () => {
  const markdown = readFileSync(new URL("../.github/workflows/rig-skill-integration-codex.md", import.meta.url), "utf8");
  const lock = readFileSync(new URL("../.github/workflows/rig-skill-integration-codex.lock.yml", import.meta.url), "utf8");
  expect(markdown).toContain("bash: false");
  expect(markdown).toContain("cli-proxy: false");
  expect(markdown).toContain("allowed: [run_rig]");
  expect(lock).toContain("node .github/drivers/codex-fixture-mcp.ts");
  expect(lock).toContain("http://host.docker.internal:8766/mcp");
  expect(lock).toContain('"shell_tool":false');
});

it.each(["engine", "model", "request", "call-count", "verdict", "missing-judges", "order", "decision", "reason", "null"])(
  "rejects a corrupted persisted result: %s",
  async failure => {
    const result = await runWorkflow(createProviderFixture());
    if (failure === "engine") result.engine = "pi";
    if (failure === "model") result.model = "gpt-4.1";
    if (failure === "request") result.request = "Different scenario";
    if (failure === "call-count") result.modelCalls = 4;
    if (failure === "verdict") result.verdict = "reject";
    if (failure === "missing-judges") result.judgments = [];
    if (failure === "order") result.judgments.reverse();
    if (failure === "decision") result.judgments[0]!.decision = "reject";
    if (failure === "decision") result.judgments[1]!.decision = "reject";
    if (failure === "reason") result.judgments[0]!.reason = " ";
    expect(() => assertThreeJudges(failure === "null" ? null : result, "codex")).toThrow();
  },
);
