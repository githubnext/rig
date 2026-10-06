import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  approveAll: vi.fn(),
  sendAndWait: vi.fn(),
  disconnect: vi.fn(async () => {}),
  stop: vi.fn(async () => []),
  createSession: vi.fn(),
  forUri: vi.fn((uri: string, options?: { connectionToken: string }) => ({ uri, ...options })),
}));

vi.mock("@github/copilot-sdk", () => ({
  approveAll: mocks.approveAll,
  CopilotClient: function () {
    return { createSession: mocks.createSession, stop: mocks.stop };
  },
  RuntimeConnection: { forUri: mocks.forUri },
}));

import { runLauncherCli } from "rig";

const markdown = readFileSync(new URL("../.github/workflows/rig-skill-integration.md", import.meta.url), "utf8");
const fence = markdown.match(/```rig\n([\s\S]*?)\n```/);
if (!fence) throw new Error("Expected the integration workflow's Rig fence");
const program = fence[1];
const postStep = markdown.match(/      node --input-type=module <<'JS'\n([\s\S]*?)      JS/);
if (!postStep) throw new Error("Expected the integration workflow's result assertion");
const resultAssertion = postStep[1].replace(/^      /gm, "").replace(/^import .*;\n/gm, "");

function assertWorkflowResult(result: unknown): void {
  runInNewContext(resultAssertion, {
    assert,
    readFileSync: () => JSON.stringify(result),
    console: { log: () => {} },
  });
}

async function runScenario(): Promise<string> {
  const output: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  });
  await runLauncherCli([], {}, { stdin: Readable.from([program]), stdout });
  return output.join("");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("COPILOT_SDK_URI", "http://127.0.0.1:3002");
  vi.stubEnv("COPILOT_CONNECTION_TOKEN", "test-connection-token");
  vi.stubEnv("GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON", "");
  mocks.createSession.mockImplementation(async () => ({
    sendAndWait: mocks.sendAndWait,
    disconnect: mocks.disconnect,
  }));
  mocks.sendAndWait.mockReset();
  mocks.sendAndWait.mockResolvedValue({ data: { content: '{"decision":"approve","reason":"Harmless and practical."}' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Rig skill agentic workflow", () => {
  it("registers a custom driver for harness-owned fixture execution", () => {
    expect(markdown).toContain("driver: .github/drivers/rig-sdk-driver.ts");
    expect(markdown).toContain('Call `run_rig` **once**');
    expect(markdown).toContain('bash: ["printf", "node"]');
    expect(markdown).not.toContain("| node .github/skills/rig/run.ts >");
    const shared = readFileSync(new URL("../.github/workflows/shared/rig.md", import.meta.url), "utf8");
    expect(shared).toContain('bash: ["printf", "node"]');
  });

  it.each([program, 'const value = "don\'t expand $HOME, $(exit 42), `exit 42`, %s, \\\\n";\n\n// literal | && ; < >'])(
    "transports literal source through printf without shell expansion: %s",
    source => {
      const arguments_ = source.split("\n").map((line: string) => `'${line.replaceAll("'", "'\"'\"'")}'`).join(" \\\n  ");
      const command = `printf '%s\\n' \\\n  ${arguments_} \\\n  | "${process.execPath}" --input-type=module -e 'for await (const chunk of process.stdin) process.stdout.write(chunk)'`;
      expect(execFileSync("bash", ["-o", "pipefail", "-c", command], { encoding: "utf8" })).toBe(`${source}\n`);
    },
  );

  it("keeps runtime printf examples executable and literal", () => {
    const runtime = readFileSync(new URL("../skills/rig/runtime.md", import.meta.url), "utf8");
    const example = runtime.match(/```bash\n(printf[\s\S]*?)\n```/)?.[1];
    expect(example).toBeDefined();
    const command = example!.replace("| node skills/rig/run.ts", `| "${process.execPath}" --input-type=module -e 'for await (const chunk of process.stdin) process.stdout.write(chunk)'`);
    expect(execFileSync("bash", ["-o", "pipefail", "-c", command], { encoding: "utf8" }))
      .toBe('// Agent role: summarize this repository in one sentence.\nexport default "Summarize this repository in one sentence.";\n');
  });

  it("directs one tool launch without Bash preparation or retries", () => {
    expect(markdown).toContain("Node.js and SDK dependencies are already provisioned");
    expect(markdown).toContain("Copy every source line unchanged");
    expect(markdown).toContain("Do not use Bash to launch, read, or validate the fixture");
    expect(markdown).toContain("Never call `noop` on failure");
    expect(markdown).toContain("The one-invocation limit includes denials");
    expect(markdown).toContain("stop immediately");
  });

  it("requires credential forwarding without exposing the connection token", () => {
    expect(markdown).toContain("private pipe, not through Rig's environment");
    expect(markdown).toContain("Do not inspect credentials");
    expect(markdown).toContain("supply\na token as a tool argument");
    const skill = readFileSync(new URL("../skills/rig/SKILL.md", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("../skills/rig/runtime.md", import.meta.url), "utf8");
    expect(skill).toContain("`COPILOT_SDK_URI` and `COPILOT_CONNECTION_TOKEN`");
    expect(skill).toContain("do not drop the token");
    expect(runtime).toContain("RuntimeConnection.forUri(uri, { connectionToken })");
    expect(runtime).toContain("Do not replace the environment with a map that omits the connection token");
  });

  it("runs the actual workflow fence with exactly three small SDK calls", async () => {
    const result = JSON.parse(await runScenario());
    expect(result).toEqual({
      request: expect.stringContaining("three fruit names"),
      modelCalls: 3,
      verdict: "approve",
      judgments: ["clarity", "safety", "feasibility"].map((criterion: string) => ({
        criterion, decision: "approve", reason: "Harmless and practical.",
      })),
    });
    expect(mocks.createSession).toHaveBeenCalledTimes(3);
    expect(mocks.sendAndWait).toHaveBeenCalledTimes(3);
    expect(mocks.disconnect).toHaveBeenCalledTimes(3);
    expect(mocks.stop).toHaveBeenCalledTimes(3);
    expect(mocks.forUri).toHaveBeenCalledWith("http://127.0.0.1:3002", { connectionToken: "test-connection-token" });
    for (const [config] of mocks.createSession.mock.calls) {
      expect(config.model).toBe("small");
    }
    for (const [index, [request]] of mocks.sendAndWait.mock.calls.entries()) {
      expect(request.prompt).toContain(["clarity", "safety", "feasibility"][index]);
      expect(request.prompt).toContain(result.request);
      expect(request.responseSchema.properties.decision.enum).toEqual(["approve", "reject"]);
    }
  });

  it("uses deterministic majority voting without a synthesis call", async () => {
    mocks.sendAndWait.mockResolvedValueOnce({ data: { content: '{"decision":"reject","reason":"One dissenting judge."}' } });
    const result = JSON.parse(await runScenario());
    expect(result.verdict).toBe("approve");
    expect(result.judgments[0].decision).toBe("reject");
    expect(mocks.sendAndWait).toHaveBeenCalledTimes(3);
  });

  it("forwards the workflow's small-model provider configuration to every session", async () => {
    const providerConfig = {
      model: "resolved-small-model",
      providers: [{ name: "copilot", baseUrl: "http://api-proxy.test" }],
      models: [{ id: "resolved-small-model", provider: "copilot" }],
    };
    vi.stubEnv("GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON", JSON.stringify(providerConfig));
    await runScenario();
    expect(mocks.createSession).toHaveBeenCalledTimes(3);
    for (const [config] of mocks.createSession.mock.calls) {
      expect(config).toMatchObject(providerConfig);
    }
    expect(markdown).toContain("\nmodel: small\n");
    expect(markdown).toContain("\nskills:\n  - skills/rig\n");
  });

  it("fails rather than approving an unexpected majority rejection", async () => {
    mocks.sendAndWait.mockResolvedValue({ data: { content: '{"decision":"reject","reason":"Rejected."}' } });
    await expect(runScenario()).rejects.toThrow("Dummy request integration failed");
    expect(mocks.sendAndWait).toHaveBeenCalledTimes(3);
  });

  it.each([
    '{"decision":"maybe","reason":"Invalid decision."}',
    '{"decision":"approve"}',
    '{"decision":"approve","reason":"   "}',
    "not JSON",
  ])("fails invalid output without repair or retry: %s", async content => {
    mocks.sendAndWait.mockResolvedValue({ data: { content } });
    await expect(runScenario()).rejects.toThrow("Missing or invalid clarity judgment");
    expect(mocks.sendAndWait).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("fails an SDK error without returning a success-shaped result", async () => {
    mocks.sendAndWait.mockRejectedValueOnce(new Error("SDK unavailable"));
    await expect(runScenario()).rejects.toThrow("Missing or invalid clarity judgment");
    expect(mocks.sendAndWait).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it("accepts a successful result in the workflow post-step", async () => {
    assertWorkflowResult(JSON.parse(await runScenario()));
  });

  it.each(["call-count", "verdict", "missing-judges", "empty-reason"])(
    "rejects a bad result in the workflow post-step: %s",
    async failure => {
      const result = JSON.parse(await runScenario());
      if (failure === "call-count") result.modelCalls = 4;
      if (failure === "verdict") result.verdict = "reject";
      if (failure === "missing-judges") result.judgments = [];
      if (failure === "empty-reason") result.judgments[0].reason = "";
      expect(() => assertWorkflowResult(result)).toThrow();
    },
  );
});
