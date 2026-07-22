import { Codex } from "@openai/codex-sdk";
import type { CodexOptions, ThreadOptions } from "@openai/codex-sdk";
import type { AgentFactory } from "../rig.ts";

export type CodexEngineOptions = CodexOptions & {
  thread?: Omit<ThreadOptions, "model">;
};

export function codexEngine(options: CodexEngineOptions = {}): AgentFactory {
  const { thread: threadOptions, ...clientOptions } = options;
  return (agentOptions) => {
    if (agentOptions.tools && agentOptions.tools.length > 0) {
      throw new Error("codexEngine does not support Rig tools");
    }
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

    return {
      async ask(prompt, askOptions = {}) {
        const turn = await thread.run(prompt, askOptions.signal ? { signal: askOptions.signal } : undefined);
        return turn.finalResponse;
      },
      async close() {},
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
