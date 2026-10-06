import { Agent as PiAgent } from "@earendil-works/pi-agent-core";
import type { AgentTool as PiAgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { Models } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { debug } from "../rig.ts";
import type { AgentFactory, Tool } from "../rig.ts";
import { agentLifecycle, objectToolSchema, toolResultText } from "./utils.ts";

const debugCreate = debug("engine:pi:create");
const debugAsk = debug("engine:pi:ask");
const debugResponse = debug("engine:pi:response");
const debugTool = debug("engine:pi:tool");
const debugClose = debug("engine:pi:close");

export type PiEngineOptions = {
  provider: string;
  models?: Models;
};

export function piEngine(options: PiEngineOptions): AgentFactory {
  const models = options.models ?? builtinModels();
  return (agentOptions) => {
    const model = models.getModel(options.provider, agentOptions.model);
    if (!model) {
      throw new Error(`Unknown pi-agent model: ${options.provider}/${agentOptions.model}`);
    }
    debugCreate({ provider: options.provider, model: agentOptions.model, tools: agentOptions.tools?.map((tool) => tool.name) ?? [] });
    const piAgent = new PiAgent({
      streamFn: models.streamSimple.bind(models),
      initialState: {
        model,
        systemPrompt: stringSystemMessage(agentOptions.systemMessage),
        tools: agentOptions.tools?.map(toPiTool) ?? [],
      },
    });
    const lifecycle = agentLifecycle("piEngine");

    return {
      ask(prompt, askOptions = {}) {
        return lifecycle.run(askOptions.signal, async (signal) => {
          debugAsk({ model: agentOptions.model, prompt });
          const abort = () => piAgent.abort();
          signal.addEventListener("abort", abort, { once: true });
          try {
            await piAgent.prompt(prompt);
            signal.throwIfAborted();
            if (piAgent.state.errorMessage) {
              throw new Error(piAgent.state.errorMessage);
            }
            const text = piResponseText(piAgent.state.messages);
            debugResponse({ model: agentOptions.model, response: text });
            return text;
          } finally {
            signal.removeEventListener("abort", abort);
          }
        });
      },
      async close() {
        debugClose({ model: agentOptions.model });
        const closing = lifecycle.close();
        await piAgent.waitForIdle();
        await closing;
      },
    };
  };
}

function stringSystemMessage(systemMessage: unknown): string {
  if (systemMessage === undefined) {
    return "";
  }
  if (typeof systemMessage !== "string") {
    throw new TypeError("piEngine requires systemMessage to be a string");
  }
  return systemMessage;
}

function toPiTool(tool: Tool<any>): PiAgentTool {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description ?? "",
    parameters: Type.Unsafe(objectToolSchema(tool)),
    async execute(_toolCallId, params) {
      if (!tool.handler) {
        throw new Error(`${tool.name} tool has no handler`);
      }
      debugTool({ tool: tool.name, args: params });
      const result = await tool.handler(params);
      return {
        content: [{ type: "text", text: toolResultText(result) }],
        details: result,
      };
    },
  };
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) {
    return typeof content === "string" ? content : "";
  }
  return content
    .filter((block): block is { type: "text"; text: string } =>
      block !== null
      && typeof block === "object"
      && (block as { type?: unknown }).type === "text"
      && typeof (block as { text?: unknown }).text === "string")
    .map((block) => block.text)
    .join("");
}

function piResponseText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown; content?: unknown };
    if (message.role === "assistant") {
      return contentText(message.content);
    }
  }
  return "";
}
