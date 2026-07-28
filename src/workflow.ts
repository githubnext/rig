import { availableParallelism } from "node:os";
import {
  agent,
  type AgentFn,
  type AgentInputValue,
  type CallOptions,
  type InferSchema,
  type PromptBuilder,
  type Schema,
} from "../skills/rig/rig.ts";

export type WorkflowMeta = {
  name: string;
  description: string;
  phases: readonly string[];
};

export type WorkflowCallOptions = CallOptions & {
  label?: string;
};

export type WorkflowEvent =
  | { type: "run_start"; meta: WorkflowMeta; ts: number }
  | { type: "phase_start"; phase: string; ts: number }
  | { type: "agent_start"; id: number; agent: string; phase?: string; label?: string; ts: number }
  | { type: "agent_done"; id: number; agent: string; phase?: string; label?: string; ms: number; ts: number }
  | { type: "agent_failed"; id: number; agent: string; phase?: string; label?: string; error: string; ms: number; ts: number }
  | { type: "log"; message: string; phase?: string; ts: number }
  | { type: "warning"; message: string; ts: number }
  | { type: "run_done"; status: "completed" | "aborted"; ms: number; ts: number }
  | { type: "run_failed"; error: string; ms: number; ts: number };

export type UntilOptions = {
  max: number;
  noProgressRounds?: number;
};

export type UntilStep<S> = (
  state: S | undefined,
  round: number,
) => Promise<{ state: S; done?: boolean; progressKey?: string }> | { state: S; done?: boolean; progressKey?: string };

export type WorkflowCall = {
  <Input, Output>(
    worker: AgentFn<Input, Output>,
    input: AgentInputValue<Input>,
    options?: WorkflowCallOptions,
  ): Promise<Output | null>;
  text(prompt: string | PromptBuilder, options?: WorkflowCallOptions): Promise<string | null>;
};

export type WorkflowContext<Input> = {
  input: Input;
  call: WorkflowCall;
  pipeline<Item, Result>(
    items: readonly Item[],
    fn: (item: Item, index: number) => Promise<Result> | Result,
  ): Promise<(Result | null)[]>;
  parallel<Result>(
    thunks: readonly (() => Promise<Result> | Result)[],
  ): Promise<(Result | null)[]>;
  until<S>(options: UntilOptions, step: UntilStep<S>): Promise<S>;
  phase(name: string): void;
  log(message: string): void;
  signal: AbortSignal;
};

export type WorkflowSpec<Input extends Schema, Output> = {
  meta: WorkflowMeta;
  input: Input;
  body(context: WorkflowContext<InferSchema<Input>>): Promise<Output> | Output;
};

export type Workflow<Input, Output> = {
  readonly meta: WorkflowMeta;
  readonly inputSchema?: Schema;
  readonly body: (context: WorkflowContext<Input>) => Promise<Output> | Output;
};

type WorkflowWithoutInputSpec<Output> = {
  meta: WorkflowMeta;
  body(context: WorkflowContext<undefined>): Promise<Output> | Output;
};

export function workflow<const Input extends Schema, Output>(
  spec: WorkflowSpec<Input, Output>,
): Workflow<InferSchema<Input>, Output>;
export function workflow<Output>(spec: WorkflowWithoutInputSpec<Output>): Workflow<undefined, Output>;
export function workflow(
  spec: WorkflowSpec<Schema, unknown> | WorkflowWithoutInputSpec<unknown>,
): Workflow<unknown, unknown> {
  return {
    meta: spec.meta,
    ...("input" in spec && { inputSchema: spec.input }),
    body: spec.body as (context: WorkflowContext<unknown>) => unknown,
  };
}

export type WorkflowLimits = {
  concurrency?: number;
  maxAgents?: number;
  maxWallMs?: number;
  warnAgents?: number;
};

export type RunWorkflowOptions<Input> = {
  args?: Input;
  limits?: WorkflowLimits;
  onEvent?: (event: WorkflowEvent) => void;
  signal?: AbortSignal;
};

export class WorkflowLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowLimitError";
  }
}

class Limiter {
  readonly #limit: number;
  #active = 0;
  readonly #waiting: (() => void)[] = [];

  constructor(limit: number) {
    this.#limit = limit;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#active >= this.#limit) {
      await new Promise<void>((resolve) => this.#waiting.push(resolve));
    }
    this.#active += 1;
    try {
      return await fn();
    } finally {
      this.#active -= 1;
      this.#waiting.shift()?.();
    }
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function eventFields(phase: string | undefined, label: string | undefined): {
  phase?: string;
  label?: string;
} {
  return {
    ...(phase !== undefined && { phase }),
    ...(label !== undefined && { label }),
  };
}

export async function parallel<Result>(
  thunks: readonly (() => Promise<Result> | Result)[],
): Promise<(Result | null)[]> {
  return Promise.all(thunks.map(async (thunk) => {
    try {
      return await thunk();
    } catch (error) {
      if (error instanceof WorkflowLimitError) throw error;
      return null;
    }
  }));
}

export async function pipeline<Item, Result>(
  items: readonly Item[],
  fn: (item: Item, index: number) => Promise<Result> | Result,
): Promise<(Result | null)[]> {
  return Promise.all(items.map((item, index) => fn(item, index)));
}

export async function until<S>(options: UntilOptions, step: UntilStep<S>): Promise<S> {
  const max = positiveInteger(options.max, "until max");
  const noProgressRounds = options.noProgressRounds === undefined
    ? undefined
    : positiveInteger(options.noProgressRounds, "until noProgressRounds");
  let state: S | undefined;
  let previousKey: string | undefined;
  let sameKeyRounds = 0;

  for (let round = 0; round < max; round += 1) {
    const result = await step(state, round);
    state = result.state;
    if (result.done) return state;

    if (noProgressRounds !== undefined && result.progressKey !== undefined) {
      sameKeyRounds = result.progressKey === previousKey ? sameKeyRounds + 1 : 1;
      previousKey = result.progressKey;
      if (sameKeyRounds >= noProgressRounds) return state;
    }
  }

  if (state === undefined) {
    throw new Error("until did not run.");
  }
  return state;
}

function combinedSignal(signal: AbortSignal, callSignal: AbortSignal | undefined): AbortSignal {
  return callSignal === undefined ? signal : AbortSignal.any([signal, callSignal]);
}

export async function runWorkflow<Input, Output>(
  definition: Workflow<Input, Output>,
  options: RunWorkflowOptions<Input> = {},
): Promise<Output> {
  const concurrency = positiveInteger(
    options.limits?.concurrency ?? Math.min(16, Math.max(2, availableParallelism())),
    "workflow concurrency",
  );
  const maxAgents = positiveInteger(options.limits?.maxAgents ?? 1000, "workflow maxAgents");
  const warnAgents = positiveInteger(options.limits?.warnAgents ?? 25, "workflow warnAgents");
  const maxWallMs = options.limits?.maxWallMs;
  if (maxWallMs !== undefined) positiveInteger(maxWallMs, "workflow maxWallMs");

  const started = Date.now();
  const controller = new AbortController();
  const signal = options.signal === undefined
    ? controller.signal
    : AbortSignal.any([controller.signal, options.signal]);
  let failWallLimit: ((error: WorkflowLimitError) => void) | undefined;
  const wallLimit = maxWallMs === undefined
    ? undefined
    : new Promise<never>((_resolve, reject) => {
      failWallLimit = reject;
    });
  const timer = maxWallMs === undefined
    ? undefined
    : setTimeout(() => {
      const error = new WorkflowLimitError(`Workflow exceeded maxWallMs (${maxWallMs}).`);
      controller.abort(error);
      failWallLimit?.(error);
    }, maxWallMs);
  timer?.unref();

  const emit = (event: WorkflowEvent): void => {
    try {
      options.onEvent?.(event);
    } catch {
      // Observers must not affect workflow execution.
    }
  };
  emit({ type: "run_start", meta: definition.meta, ts: started });

  const limiter = new Limiter(concurrency);
  let currentPhase: string | undefined;
  let agentCount = 0;

  const call = (async <CallInput, CallOutput>(
    worker: AgentFn<CallInput, CallOutput>,
    input: AgentInputValue<CallInput>,
    callOptions: WorkflowCallOptions = {},
  ): Promise<CallOutput | null> => {
    agentCount += 1;
    if (agentCount > maxAgents) {
      throw new WorkflowLimitError(`Workflow exceeded maxAgents (${maxAgents}).`);
    }
    if (agentCount === warnAgents + 1) {
      emit({ type: "warning", message: `Workflow scheduled more than ${warnAgents} agents.`, ts: Date.now() });
    }

    const id = agentCount;
    const agentName = worker.agentName;
    const phase = currentPhase;
    const { label, signal: callSignal, ...agentOptions } = callOptions;
    const fields = eventFields(phase, label);
    const callStarted = Date.now();
    emit({ type: "agent_start", id, agent: agentName, ...fields, ts: callStarted });

    try {
      const output = await limiter.run(() => worker(input, {
        ...agentOptions,
        signal: combinedSignal(signal, callSignal),
      }));
      emit({ type: "agent_done", id, agent: agentName, ...fields, ms: Date.now() - callStarted, ts: Date.now() });
      return output;
    } catch (error) {
      emit({
        type: "agent_failed",
        id,
        agent: agentName,
        ...fields,
        error: errorMessage(error),
        ms: Date.now() - callStarted,
        ts: Date.now(),
      });
      return null;
    }
  }) as WorkflowCall;

  call.text = (prompt, callOptions = {}) => {
    const textAgent = agent({
      name: callOptions.label ?? "workflow-text",
      instructions: prompt,
    });
    return call(textAgent, "", callOptions);
  };

  const runUntil = <S>(untilOptions: UntilOptions, step: UntilStep<S>): Promise<S> =>
    until(untilOptions, async (state, round) => {
      signal.throwIfAborted();
      const result = await step(state, round);
      signal.throwIfAborted();
      return result;
    });

  const context: WorkflowContext<Input> = {
    input: options.args as Input,
    call,
    pipeline,
    parallel,
    until: runUntil,
    phase(name) {
      currentPhase = name;
      emit({ type: "phase_start", phase: name, ts: Date.now() });
    },
    log(message) {
      emit({ type: "log", message, ...(currentPhase !== undefined && { phase: currentPhase }), ts: Date.now() });
    },
    signal,
  };

  try {
    const body = Promise.resolve(definition.body(context));
    const output = await (wallLimit === undefined ? body : Promise.race([body, wallLimit]));
    emit({
      type: "run_done",
      status: signal.aborted ? "aborted" : "completed",
      ms: Date.now() - started,
      ts: Date.now(),
    });
    return output;
  } catch (error) {
    if (!controller.signal.aborted) controller.abort(error);
    emit({ type: "run_failed", error: errorMessage(error), ms: Date.now() - started, ts: Date.now() });
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
