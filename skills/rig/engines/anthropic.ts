import Anthropic from "@anthropic-ai/sdk";
import type { ClientOptions } from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat, betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { BetaMessage, BetaMessageParam, BetaTextBlock, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta";
import { debug } from "../rig.ts";
import type { AgentFactory, Tool } from "../rig.ts";
import { agentLifecycle, objectToolSchema, toolResultText } from "./utils.ts";

const debugCreate = debug("engine:anthropic:create");
const debugAsk = debug("engine:anthropic:ask");
const debugResponse = debug("engine:anthropic:response");
const debugTool = debug("engine:anthropic:tool");
const debugClose = debug("engine:anthropic:close");

export type AnthropicEngineOptions = ClientOptions & {
  maxTokens?: number;
  maxIterations?: number;
};

export function anthropicEngine(options: AnthropicEngineOptions = {}): AgentFactory {
  const { maxTokens = 8192, maxIterations, ...clientOptions } = options;
  return (agentOptions) => {
    const systemMessage = anthropicSystemMessage(agentOptions.systemMessage);
    debugCreate({ model: agentOptions.model, tools: agentOptions.tools?.map((tool) => tool.name) ?? [] });
    const client = new Anthropic(clientOptions);
    const lifecycle = agentLifecycle("anthropicEngine");
    let messages: BetaMessageParam[] = [];
    const tools = agentOptions.tools?.map(toAnthropicTool) ?? [];

    return {
      ask(prompt, askOptions = {}) {
        return lifecycle.run(askOptions.signal, async (signal) => {
          debugAsk({ model: agentOptions.model, prompt });
          const requestMessages: BetaMessageParam[] = [...messages, { role: "user" as const, content: prompt }];
          const outputSchema = askOptions.outputSchema;
          const outputFormat = outputSchema?.["type"] === "object" && supportsStructuredSchema(outputSchema)
            ? betaJSONSchemaOutputFormat({ ...outputSchema, type: "object" })
            : undefined;
          const runner = client.beta.messages.toolRunner({
            model: agentOptions.model,
            max_tokens: maxTokens,
            messages: requestMessages,
            tools,
            ...(maxIterations !== undefined && { max_iterations: maxIterations }),
            ...(systemMessage !== undefined && { system: systemMessage }),
            ...(outputFormat !== undefined && {
              output_config: { format: outputFormat },
            }),
          }, { signal });
          const response = await runner.runUntilDone();
          signal.throwIfAborted();
          messages = [...runner.params.messages];
          const text = contentText(response.content);
          debugResponse({ model: agentOptions.model, response: text });
          return text;
        });
      },
      async close() {
        debugClose({ model: agentOptions.model });
        await lifecycle.close();
      },
    };
  };
}

function toAnthropicTool(tool: Tool<any>) {
  return betaTool({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: objectToolSchema(tool),
    async run(args) {
      if (!tool.handler) {
        throw new Error(`${tool.name} tool has no handler`);
      }
      debugTool({ tool: tool.name, args });
      return toolResultText(await tool.handler(args));
    },
  });
}

function anthropicSystemMessage(value: unknown): string | BetaTextBlockParam[] | undefined {
  if (value === undefined || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.every((block: unknown): block is BetaTextBlockParam =>
    block !== null && typeof block === "object"
    && "type" in block && block.type === "text"
    && "text" in block && typeof block.text === "string")) {
    return value;
  }
  throw new TypeError("anthropicEngine requires systemMessage to be a string or text block array");
}

function supportsStructuredSchema(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const schema = value as Record<string, unknown>;
  if (schema["anyOf"] !== undefined) {
    return Array.isArray(schema["anyOf"]) && schema["anyOf"].length > 0
      && schema["anyOf"].every(supportsStructuredSchema);
  }
  if (schema["type"] === "object") {
    if (schema["additionalProperties"] !== undefined && schema["additionalProperties"] !== false) {
      return false;
    }
    const properties = schema["properties"];
    return properties === undefined || (properties !== null && typeof properties === "object"
      && !Array.isArray(properties) && Object.values(properties).every(supportsStructuredSchema));
  }
  if (schema["type"] === "array") {
    return supportsStructuredSchema(schema["items"]);
  }
  return ["string", "number", "integer", "boolean", "null"].includes(String(schema["type"]));
}

function contentText(content: BetaMessage["content"]): string {
  return content
    .filter((block): block is BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
