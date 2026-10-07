import { DeepSeekHarness } from "@deepseek-ai/dsh-sdk-client";
import type { DeepSeekHarnessOptions, RunResult } from "@deepseek-ai/dsh-sdk-client";
import { debug } from "../rig.ts";
import type { AgentFactory } from "../rig.ts";
import { agentLifecycle } from "./utils.ts";

const debugCreate = debug("engine:deepseek:create");
const debugAsk = debug("engine:deepseek:ask");
const debugResponse = debug("engine:deepseek:response");
const debugClose = debug("engine:deepseek:close");

export type DeepSeekEngineOptions = Omit<DeepSeekHarnessOptions, "model">;

export function deepseekEngine(options: DeepSeekEngineOptions = {}): AgentFactory {
  return (agentOptions) => {
    if (agentOptions.tools && agentOptions.tools.length > 0) {
      throw new Error("deepseekEngine does not support Rig tools");
    }
    const systemMessage = stringSystemMessage(agentOptions.systemMessage);
    debugCreate({ model: agentOptions.model, profile: options.profile ?? "sdk" });
    const harness = new DeepSeekHarness({ ...options, model: agentOptions.model });
    const session = harness.session();
    const lifecycle = agentLifecycle("deepseekEngine");
    let firstTurn = true;
    let closing: Promise<void> | undefined;
    const closeHarness = () => closing ??= Promise.resolve().then(() => harness.close());

    return {
      ask(prompt, askOptions = {}) {
        return lifecycle.run(askOptions.signal, async (signal) => {
          if (closing) {
            throw new Error("deepseekEngine is closed");
          }
          debugAsk({ model: agentOptions.model, session: session.id, prompt });
          const fullPrompt = firstTurn && systemMessage
            ? `${systemMessage}\n\n${prompt}`
            : prompt;
          let onAbort: () => void = () => {};
          const aborted = new Promise<never>((_resolve, reject) => {
            onAbort = () => reject(signal.reason);
            signal.addEventListener("abort", onAbort, { once: true });
          });
          let run: Promise<RunResult> | undefined;
          try {
            signal.throwIfAborted();
            run = session.run(fullPrompt);
            const result = await Promise.race([run, aborted]);
            signal.throwIfAborted();
            firstTurn = false;
            assertCompleted(result);
            debugResponse({ model: agentOptions.model, session: session.id, response: result.finalResponse });
            return result.finalResponse;
          } catch (error) {
            // The SDK has no turn-cancel method; reap the runtime before settling.
            const [cleanup] = await Promise.allSettled([closeHarness()]);
            if (cleanup.status === "rejected") {
              throw new AggregateError(
                [signal.aborted ? signal.reason : error, cleanup.reason],
                "DeepSeek Harness request and cleanup failed",
              );
            }
            if (run) {
              await Promise.allSettled([run]);
            }
            signal.throwIfAborted();
            throw error;
          } finally {
            signal.removeEventListener("abort", onAbort);
          }
        });
      },
      async close() {
        debugClose({ model: agentOptions.model, session: session.id });
        await lifecycle.close();
        await closeHarness();
      },
    };
  };
}

function assertCompleted(result: RunResult): void {
  for (let index = result.events.length - 1; index >= 0; index--) {
    const event = result.events[index];
    if (event?.type !== "turn/end") {
      continue;
    }
    const reason = event.data.reason;
    if (reason.kind === "error") {
      throw new Error(`DeepSeek Harness request failed: ${reason.error.message}`, { cause: reason.error });
    }
    if (reason.kind !== "completed") {
      throw new Error(`DeepSeek Harness turn ended with ${reason.kind}`);
    }
    return;
  }
  throw new Error("DeepSeek Harness returned no completed turn");
}

function stringSystemMessage(systemMessage: unknown): string | undefined {
  if (systemMessage === undefined) {
    return undefined;
  }
  if (typeof systemMessage !== "string") {
    throw new TypeError("deepseekEngine requires systemMessage to be a string");
  }
  return systemMessage;
}
