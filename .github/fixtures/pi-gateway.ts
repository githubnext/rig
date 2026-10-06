import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createModels, createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function piGateway(value: unknown) {
  if (!isObject(value) || !isObject(value["providers"]) || !isObject(value["providers"]["aw-gateway"])) {
    throw new Error("Expected the harness-provisioned Pi aw-gateway provider");
  }
  const gateway = value["providers"]["aw-gateway"];
  const baseUrl = gateway["baseUrl"];
  const api = gateway["api"];
  const models = gateway["models"];
  if (typeof baseUrl !== "string" || !baseUrl.trim()
    || (api !== "openai-completions" && api !== "openai-responses")
    || gateway["apiKey"] !== "awf-proxy"
    || !Array.isArray(models) || models.length !== 1 || !isObject(models[0])
    || typeof models[0]["id"] !== "string" || !models[0]["id"].trim()) {
    throw new Error("Invalid Copilot Pi gateway configuration");
  }
  const definition = models[0];
  const model = models[0]["id"];
  const positiveInteger = (key: string, fallback: number): number => {
    const value = definition[key];
    if (value === undefined) return fallback;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Invalid Pi gateway ${key}`);
    }
    return value;
  };
  const registry = createModels();
  registry.setProvider(createProvider({
    id: "aw-gateway",
    baseUrl,
    auth: { apiKey: { name: "AWF proxy", resolve: async () => ({ auth: { apiKey: "awf-proxy" } }) } },
    models: [{
      id: model,
      name: model,
      provider: "aw-gateway",
      api,
      baseUrl,
      reasoning: definition["reasoning"] === true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: positiveInteger("contextWindow", 128_000),
      maxTokens: positiveInteger("maxTokens", 4096),
    }],
    api: api === "openai-completions" ? openAICompletionsApi() : openAIResponsesApi(),
  }));
  return { model, models: registry };
}

export function loadPiGateway(directory: string) {
  return piGateway(JSON.parse(readFileSync(join(directory, "models.json"), "utf8")));
}
