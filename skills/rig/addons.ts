import { analyzeResponse, defaultRepairPrompt } from "./rig.ts";
import type { Agent, AgentAddon, AgentAddonContext } from "./rig.ts";

const DEFAULT_STEERING_WARNING = "You are running out of turns. This is your final attempt before reaching the turn limit. Please correct your output now.";

export type SteeringOptions = {
  /** Warning appended to the final retry prompt. */
  message?: string;
};

export type RepairOptions = {
  /** Maximum total turns, including the initial attempt and all repair retries. */
  maxTurns: number;
};

export type TimeoutOptions = {
  timeout: number;
};

export type AgentRegistration = (
  agent: Agent,
  context: AgentAddonContext,
) => void | Promise<void>;

/**
 * Appends a final-attempt warning to the retry prompt produced by an inner addon.
 *
 * Place this before `repair()`, for example
 * `addons: [steering({ message: "Return valid JSON now." }), repair({ maxTurns: 3 })]`.
 */
export function steering(options: SteeringOptions = {}): AgentAddon {
  const message = options.message ?? DEFAULT_STEERING_WARNING;
  return async (context, next) => {
    await next();
    if (context.nextPrompt && context.turn + 1 === context.maxTurns) {
      context.nextPrompt = `${context.nextPrompt}\n${message}`;
    }
  };
}

/**
 * Parses and validates responses, retrying failures within the configured turn budget.
 *
 * Agent-spec and call-time `maxTurns` values override this default.
 */
export function repair(options: RepairOptions): AgentAddon {
  const addon: AgentAddon = async (context, next) => {
    await next();
    if (context.completed || context.error !== undefined || context.nextPrompt !== undefined) {
      return;
    }
    if (context.response === undefined) {
      return;
    }
    const analysis = analyzeResponse(context.response, context.outputSchema, context.spec.name, context.turn);
    if (analysis.ok) {
      context.completed = true;
      context.output = analysis.output;
      return;
    }
    if (context.turn >= context.maxTurns) {
      context.error = analysis.error;
      return;
    }
    context.nextPrompt = defaultRepairPrompt(context.spec, analysis.error);
  };
  return Object.assign(addon, { maxTurns: options.maxTurns });
}

export function timeout(options: TimeoutOptions): AgentAddon {
  return async (context, next) => {
    context.signal = timeoutSignal(context.signal, options.timeout);
    await next();
  };
}

export function oncePerAgent(register: AgentRegistration): AgentAddon {
  const seen = new WeakSet<Agent>();
  return async (context, next) => {
    if (!seen.has(context.agent)) {
      await register(context.agent, context);
      seen.add(context.agent);
    }
    await next();
  };
}

function timeoutSignal(parent?: AbortSignal, timeoutMs?: number): AbortSignal | undefined {
  if (!timeoutMs) {
    return parent;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)),
    timeoutMs,
  );
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
  return controller.signal;
}

export const addons = {
  oncePerAgent,
  timeout,
  repair,
  steering,
};
