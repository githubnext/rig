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
    const closeController = new AbortController();
    const activeTurns = new Set<Promise<unknown>>();

    return {
      async ask(prompt, askOptions = {}) {
        throwIfAborted(closeController.signal);
        const signal = askOptions.signal
          ? AbortSignal.any([askOptions.signal, closeController.signal])
          : closeController.signal;
        const activeTurn = thread.run(prompt, { signal });
        activeTurns.add(activeTurn);
        try {
          const turn = await activeTurn;
          return turn.finalResponse;
        } finally {
          activeTurns.delete(activeTurn);
        }
      },
      async close() {
        closeController.abort(new DOMException("Agent closed", "AbortError"));
        await Promise.allSettled(activeTurns);
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

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }
}
