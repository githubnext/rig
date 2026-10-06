import type { Tool } from "../rig.ts";

export function agentLifecycle(engine: string) {
  const controller = new AbortController();
  const activeTurns = new Set<Promise<unknown>>();
  let busy = false;

  return {
    async run<T>(signal: AbortSignal | undefined, execute: (signal: AbortSignal) => Promise<T>): Promise<T> {
      const turnSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      turnSignal.throwIfAborted();
      if (busy) {
        throw new Error(`${engine} does not support concurrent turns`);
      }
      busy = true;
      try {
        const turn = execute(turnSignal);
        activeTurns.add(turn);
        try {
          const result = await turn;
          turnSignal.throwIfAborted();
          return result;
        } finally {
          activeTurns.delete(turn);
        }
      } finally {
        busy = false;
      }
    },
    async close(): Promise<void> {
      controller.abort(new DOMException("Agent closed", "AbortError"));
      await Promise.allSettled(activeTurns);
    },
  };
}

export function objectToolSchema(tool: Tool<any>): Record<string, unknown> & { type: "object" } {
  const parameters = tool.parameters ?? { type: "object", properties: {} };
  if (parameters["type"] !== "object") {
    throw new TypeError(`${tool.name} tool parameters must be an object schema`);
  }
  return parameters as Record<string, unknown> & { type: "object" };
}

export function toolResultText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result === undefined) {
    return "";
  }
  return JSON.stringify(result);
}
