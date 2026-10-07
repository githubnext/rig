import { join } from "node:path";
import { codexEngine } from "rig/engines/codex";
import { deepseekEngine } from "rig/engines/deepseek";
import { geminiEngine } from "rig/engines/gemini";
import { piEngine } from "rig/engines/pi";
import { loadPiGateway } from "./pi-gateway.ts";
import { threeJudges } from "./three-judges.ts";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required for the three-judge fixture`);
  return value;
}

export function createProviderFixture() {
  const engine = requiredEnv("RIG_JUDGE_ENGINE");
  switch (engine) {
    case "codex": {
      requiredEnv("CODEX_HOME");
      const model = requiredEnv("GH_AW_MODEL_AGENT_CODEX");
      return threeJudges(engine, model, codexEngine({
        config: {
          mcp_servers: { safeoutputs: { enabled: false }, "rig-fixture": { enabled: false } },
          web_search: "disabled",
        },
        thread: { sandboxMode: "read-only", approvalPolicy: "never", skipGitRepoCheck: true },
      }));
    }
    case "gemini":
      requiredEnv("GEMINI_API_BASE_URL");
      return threeJudges(engine, requiredEnv("GEMINI_MODEL"), geminiEngine({
        approvalMode: "plan",
        args: ["--extensions", "none"],
      }));
    case "deepseek": {
      const selectedModel = requiredEnv("RIG_JUDGE_MODEL");
      if (selectedModel !== "copilot/gpt-5.3-codex") {
        throw new Error("DeepSeek three-judge fixture requires copilot/gpt-5.3-codex");
      }
      const dshHome = requiredEnv("DSH_HOME");
      const cwd = requiredEnv("GITHUB_WORKSPACE");
      return threeJudges(engine, selectedModel.slice("copilot/".length), deepseekEngine({
        provider: "awf-proxy",
        dshHome,
        profile: "sdk",
        cwd,
        processCwd: cwd,
        patches: [join(cwd, ".github/fixtures/deepseek-judges.patch.yml")],
        env: {
          PATH: process.env["PATH"],
          HOME: process.env["HOME"],
          NODE_EXTRA_CA_CERTS: process.env["NODE_EXTRA_CA_CERTS"],
          OPENAI_API_KEY: "awf-proxy",
          DSH_TELEMETRY_DISABLED: "1",
          DSH_TOOLS_MODE: "native",
        },
      }));
    }
    case "pi": {
      const { model, models } = loadPiGateway(requiredEnv("PI_CODING_AGENT_DIR"));
      return threeJudges(engine, model, piEngine({ provider: "aw-gateway", models }));
    }
    default:
      throw new Error(`Unsupported three-judge engine: ${engine}`);
  }
}
