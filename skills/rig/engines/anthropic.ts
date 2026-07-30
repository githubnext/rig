import Anthropic from "@anthropic-ai/sdk";
import type { ClientOptions } from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { BetaMessage, BetaMessageParam, BetaTextBlock, BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta";
import { debug } from "../rig.ts";
import type { AgentFactory, Tool } from "../rig.ts";
import { objectToolSchema, toolResultText } from "./utils.ts";

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
    debugCreate({ model: agentOptions.model, tools: agentOptions.tools?.map((tool) => tool.name) ?? [] });
    const client = new Anthropic(clientOptions);
    let messages: BetaMessageParam[] = [];
    const tools = agentOptions.tools?.map(toAnthropicTool) ?? [];

    return {
      async ask(prompt, askOptions = {}) {
        debugAsk({ model: agentOptions.model, prompt });
        const requestMessages: BetaMessageParam[] = [...messages, { role: "user" as const, content: prompt }];
        const runner = client.beta.messages.toolRunner({
          model: agentOptions.model,
          max_tokens: maxTokens,
          messages: requestMessages,
          tools,
          ...(maxIterations !== undefined && { max_iterations: maxIterations }),
          ...(agentOptions.systemMessage !== undefined && { system: agentOptions.systemMessage as string | BetaTextBlockParam[] }),
        }, askOptions.signal ? { signal: askOptions.signal } : undefined);
        const response = await runner.runUntilDone();
        messages = [...runner.params.messages];
        const text = contentText(response.content);
        debugResponse({ model: agentOptions.model, response: text });
        return text;
      },
      async close() {
        debugClose({ model: agentOptions.model });
      },
    };
  };
}

function toAnthropicTool(tool: Tool<any>) {
  return betaTool({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: objectToolSchema(tool) as any,
    async run(args) {
      if (!tool.handler) {
        throw new Error(`${tool.name} tool has no handler`);
      }
      debugTool({ tool: tool.name, args });
      return toolResultText(await tool.handler(args));
    },
  });
}

function contentText(content: BetaMessage["content"]): string {
  return content
    .filter((block): block is BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
