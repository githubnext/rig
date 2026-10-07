const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

function requiredEnv(env, name) {
  if (!env[name]?.trim()) throw new Error(`${name} is required for DeepSeek Harness`);
  return env[name];
}

async function runDeepSeekHarness({ reflect, argv, env, spawn = spawnSync }) {
  const workspace = requiredEnv(env, "GITHUB_WORKSPACE");
  const selectedModel = requiredEnv(env, "DSH_MODEL");
  if (!selectedModel.startsWith("copilot/") || !selectedModel.slice("copilot/".length)) {
    throw new Error("DeepSeek Harness requires a copilot/model selection");
  }
  if (!["copilot", "github"].includes(requiredEnv(env, "GH_AW_LLM_PROVIDER"))) {
    throw new Error("DeepSeek Harness integration requires the Copilot gateway");
  }
  if (env.AWF_REFLECT_ENABLED !== "1") {
    throw new Error("DeepSeek Harness requires AWF /reflect endpoint discovery");
  }
  const result = await reflect.fetchAWFReflect();
  if (!result.ok || !result.reflectData) {
    throw new Error(`Unable to discover DeepSeek Harness gateway: ${result.reason || "empty /reflect response"}`);
  }
  const endpoint = reflect.resolveProviderEndpointFromReflect({
    provider: "github",
    reflectData: result.reflectData,
  });
  const routes = Array.isArray(result.reflectData.endpoints) ? result.reflectData.endpoints : [];
  const route = routes.find(entry =>
    entry?.configured === true && entry.provider === endpoint?.endpointProvider);
  if (!endpoint?.baseUrl
    || !["github", "copilot", "github-copilot", "github_models"].includes(endpoint.endpointProvider?.toLowerCase())
    || typeof route?.models_url !== "string") {
    throw new Error("No configured Copilot /reflect endpoint with a models URL");
  }
  const modelsURL = new URL(route.models_url);
  if (!["http:", "https:"].includes(modelsURL.protocol) || !/\/models\/?$/i.test(modelsURL.pathname)) {
    throw new Error("Copilot /reflect returned an invalid models URL");
  }
  const baseURL = reflect.deriveBaseUrlFromModelsURL(route.models_url);
  if (!baseURL) throw new Error("Copilot /reflect returned an invalid models URL");
  const model = selectedModel.slice("copilot/".length);
  const dshHome = join(workspace, ".dsh");
  mkdirSync(dshHome, { recursive: true, mode: 0o700 });
  const patch = [
    { id: "approval", config: { policy: "never" } },
    { id: "agent-default-model", config: { provider: "awf-proxy", model } },
    {
      id: "llm-pi-ai",
      config: {
        providers: {
          "awf-proxy": {
            displayName: "GitHub Agentic Workflows",
            apiKeyEnv: "OPENAI_API_KEY",
            api: "openai-completions",
            baseURL,
            retryPolicy: { mode: "normal", maxRetries: 0 },
            models: [{ id: model, name: model }],
          },
        },
      },
    },
  ];
  writeFileSync(join(dshHome, "cordis.patch.yml"), JSON.stringify(patch, null, 2), { mode: 0o600 });
  const prompt = readFileSync(requiredEnv(env, "GH_AW_PROMPT"), "utf8");
  const [command, ...args] = argv;
  if (!command) throw new Error("DeepSeek Harness executable is required");
  const child = spawn(command, [...args, prompt], {
    cwd: workspace,
    env: { ...env, DSH_HOME: dshHome, OPENAI_API_KEY: "awf-proxy" },
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  if (child.status !== 0) {
    const error = new Error(`DeepSeek Harness exited with code ${child.status ?? "unknown"}`);
    error.exitCode = Number.isInteger(child.status) && child.status !== 0 ? child.status : 1;
    throw error;
  }
}

module.exports = { runDeepSeekHarness };
