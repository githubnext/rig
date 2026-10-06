import { Codex } from "@openai/codex-sdk";
import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import { debug, normalizeResponseSchema } from "../rig.ts";
import type { AgentFactory } from "../rig.ts";
import { agentLifecycle } from "./utils.ts";

const debugCreate = debug("engine:codex:create");
const debugAsk = debug("engine:codex:ask");
const debugResponse = debug("engine:codex:response");
const debugClose = debug("engine:codex:close");

export type CodexEngineOptions = CodexOptions & {
  thread?: Omit<ThreadOptions, "model">;
};

export function codexEngine(options: CodexEngineOptions = {}): AgentFactory {
  const { thread: threadOptions, ...clientOptions } = options;
  return (agentOptions) => {
    if (agentOptions.tools && agentOptions.tools.length > 0) {
      throw new Error("codexEngine does not support Rig tools");
    }
    debugCreate({ model: agentOptions.model });
    const systemMessage = stringSystemMessage(agentOptions.systemMessage);
    const codex = new Codex({
      ...clientOptions,
      ...(systemMessage !== undefined && {
        config: {
          ...clientOptions.config,
          developer_instructions: systemMessage,
        },
      }),
    });
    const thread = codex.startThread({
      ...threadOptions,
      model: agentOptions.model,
    });
    const lifecycle = agentLifecycle("codexEngine");

    return {
      ask(prompt, askOptions = {}) {
        return lifecycle.run(askOptions.signal, async (signal) => {
          debugAsk({ model: agentOptions.model, prompt, structured: askOptions.outputSchema !== undefined });
          const turn = await thread.run(prompt, {
            signal,
            ...(askOptions.outputSchema !== undefined && { outputSchema: normalizeResponseSchema(askOptions.outputSchema) }),
          });
          const text = typeof turn.finalResponse === "string" ? turn.finalResponse : JSON.stringify(turn.finalResponse);
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

function stringSystemMessage(systemMessage: unknown): string | undefined {
  if (systemMessage === undefined) {
    return undefined;
  }
  if (typeof systemMessage !== "string") {
    throw new TypeError("codexEngine requires systemMessage to be a string");
  }
  return systemMessage;
}
