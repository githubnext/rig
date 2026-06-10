import { analyzeResponse, defaultRepairPrompt } from "./rig.ts";
import type { AgentAddon, AgentAddonContext, CopilotSession } from "./rig.ts";

const DEFAULT_STEERING_WARNING = "You are running out of turns. This is your final attempt before reaching the turn limit. Please correct your output now.";

export type SteeringOptions = {
  message?: string;
};

export type TimeoutOptions = {
  timeout: number;
};

export type SessionRegistration = (
  session: CopilotSession,
  context: AgentAddonContext,
) => void | Promise<void>;

export function steering(options: SteeringOptions = {}): AgentAddon {
  const message = options.message ?? DEFAULT_STEERING_WARNING;
  return async (context, next) => {
    await next();
    if (context.nextPrompt && context.turn + 1 === context.maxTurns) {
      context.nextPrompt = `${context.nextPrompt}\n${message}`;
    }
  };
}

export const repair: AgentAddon = async (context, next) => {
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

export function timeout(options: TimeoutOptions): AgentAddon {
  return async (context, next) => {
    context.signal = timeoutSignal(context.signal, options.timeout);
    await next();
  };
}

export function oncePerSession(register: SessionRegistration): AgentAddon {
  const seen = new WeakSet<CopilotSession>();
  return async (context, next) => {
    if (!seen.has(context.session)) {
      await register(context.session, context);
      seen.add(context.session);
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
  oncePerSession,
  timeout,
  repair,
  steering,
};
