import { describe, expect, it, vi } from "vitest";
import type { AgentFn, CallOptions } from "rig";
import {
  configureAgent,
  WorkflowLimitError,
  parallel,
  runWorkflow,
  until,
  workflow,
  type WorkflowEvent,
} from "rig";
import { s } from "rig";

function fakeAgent<Input, Output>(
  name: string,
  invoke: (input: Input, options?: CallOptions) => Promise<Output> | Output,
): AgentFn<Input, Output> {
  return Object.assign(invoke, { agentName: name }) as unknown as AgentFn<Input, Output>;
}

describe("workflow", () => {
  it("passes typed input through a workflow", async () => {
    const definition = workflow({
      meta: { name: "typed", description: "typed input", phases: [] },
      input: s.object({ value: s.number }),
      body: ({ input }) => input.value * 2,
    });

    await expect(runWorkflow(definition, { args: { value: 4 } })).resolves.toBe(8);
  });

  it("preserves pipeline order and returns null for failed agents", async () => {
    const worker = fakeAgent<number, number>("worker", async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 6 - value));
      if (value === 2) throw new Error("failed");
      return value * 10;
    });
    const definition = workflow({
      meta: { name: "fan-out", description: "fan out", phases: ["Work"] },
      body: async ({ call, phase, pipeline }) => {
        phase("Work");
        return pipeline([1, 2, 3], (value) => call(worker, value, { label: String(value) }));
      },
    });

    await expect(runWorkflow(definition)).resolves.toEqual([10, null, 30]);
  });

  it("shares one concurrency limit across nested fan-out", async () => {
    let active = 0;
    let peak = 0;
    const worker = fakeAgent<number, number>("worker", async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value;
    });
    const definition = workflow({
      meta: { name: "nested", description: "nested fan out", phases: [] },
      body: ({ call, pipeline }) => pipeline([1, 2], (outer) =>
        pipeline([1, 2, 3], (inner) => call(worker, outer * inner))),
    });

    await runWorkflow(definition, { limits: { concurrency: 2 } });
    expect(peak).toBe(2);
  });

  it("fails the run when the total agent cap is exceeded", async () => {
    const worker = fakeAgent<number, number>("worker", (value) => value);
    const events: WorkflowEvent[] = [];
    const definition = workflow({
      meta: { name: "capped", description: "capped", phases: [] },
      body: ({ call, pipeline }) => pipeline([1, 2, 3], (value) => call(worker, value)),
    });

    await expect(runWorkflow(definition, {
      limits: { maxAgents: 2 },
      onEvent: (event) => events.push(event),
    })).rejects.toBeInstanceOf(WorkflowLimitError);
    expect(events.at(-1)?.type).toBe("run_failed");
  });

  it("does not hide programming errors in pipeline callbacks", async () => {
    const definition = workflow({
      meta: { name: "broken", description: "broken callback", phases: [] },
      body: ({ pipeline }) => pipeline([1], () => {
        throw new TypeError("callback bug");
      }),
    });

    await expect(runWorkflow(definition)).rejects.toThrow("callback bug");
  });

  it("emits phase, log, agent, and completion events", async () => {
    const worker = fakeAgent<string, string>("echo", (value) => value);
    const events: WorkflowEvent[] = [];
    const definition = workflow({
      meta: { name: "events", description: "events", phases: ["Run"] },
      body: async ({ call, log, phase }) => {
        phase("Run");
        log("starting");
        return call(worker, "ok", { label: "echo call" });
      },
    });

    await expect(runWorkflow(definition, {
      onEvent: (event) => events.push(event),
    })).resolves.toBe("ok");
    expect(events.map((event) => event.type)).toEqual([
      "run_start",
      "phase_start",
      "log",
      "agent_start",
      "agent_done",
      "run_done",
    ]);
    expect(events[3]).toMatchObject({ phase: "Run", label: "echo call" });
  });

  it("aborts in-flight calls at the wall-clock limit", async () => {
    const worker = fakeAgent<void, string>("slow", (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      }));
    const events: WorkflowEvent[] = [];
    const definition = workflow({
      meta: { name: "wall", description: "wall limit", phases: [] },
      body: ({ call }) => call(worker, undefined),
    });

    await expect(runWorkflow(definition, {
      limits: { maxWallMs: 5 },
      onEvent: (event) => events.push(event),
    })).rejects.toThrow("Workflow exceeded maxWallMs (5).");
    expect(events.at(-1)).toMatchObject({ type: "run_failed" });
  });
});

describe("workflow primitives", () => {
  it("parallel converts thrown tasks to ordered null holes", async () => {
    await expect(parallel([
      async () => 1,
      async () => { throw new Error("no"); },
      async () => 3,
    ])).resolves.toEqual([1, null, 3]);
  });

  it("until stops on completion or repeated progress keys", async () => {
    const complete = vi.fn(async (state: number | undefined) => ({
      state: (state ?? 0) + 1,
      done: state === 1,
    }));
    await expect(until({ max: 5 }, complete)).resolves.toBe(2);
    expect(complete).toHaveBeenCalledTimes(2);

    const stalled = vi.fn(async (state: number | undefined) => ({
      state: (state ?? 0) + 1,
      progressKey: "unchanged",
    }));
    await expect(until({ max: 10, noProgressRounds: 2 }, stalled)).resolves.toBe(2);
    expect(stalled).toHaveBeenCalledTimes(2);
  });
});

describe("dynamic-workflow parity", () => {
  it("threads pipeline stages per item and keeps the original item", async () => {
    const seen: [number, number, number][] = [];
    const definition = workflow({
      meta: {
        name: "stages",
        description: "multi-stage pipeline",
        phases: [{ title: "Work", detail: "two stages" }],
        whenToUse: "when each item needs several steps",
      },
      body: ({ pipeline }) => pipeline(
        [1, 2, 3],
        (previous: number, item: number, index: number) => {
          seen.push([previous, item, index]);
          return previous * 10;
        },
        (previous: number, item: number) => previous + item,
      ),
    });

    await expect(runWorkflow(definition)).resolves.toEqual([11, 22, 33]);
    expect(seen).toEqual([[1, 1, 0], [2, 2, 1], [3, 3, 2]]);
  });

  it("records a per-call phase override", async () => {
    const worker = fakeAgent<string, string>("echo", (value) => value);
    const events: WorkflowEvent[] = [];
    const definition = workflow({
      meta: { name: "phased", description: "phase override" },
      body: async ({ call, phase }) => {
        phase("Ambient");
        return call(worker, "ok", { phase: "Verify", label: "check" });
      },
    });

    await runWorkflow(definition, { onEvent: (event) => events.push(event) });
    expect(events.find((event) => event.type === "agent_start")).toMatchObject({
      phase: "Verify",
      label: "check",
    });
  });

  it("meters the agent budget", async () => {
    const worker = fakeAgent<number, number>("worker", (value) => value);
    const definition = workflow({
      meta: { name: "budgeted", description: "budget meter" },
      body: async ({ budget, call }) => {
        const before = budget.remaining();
        await call(worker, 1);
        return { total: budget.total, before, spent: budget.spent(), after: budget.remaining() };
      },
    });

    await expect(runWorkflow(definition, { limits: { maxAgents: 4 } })).resolves.toEqual({
      total: 4,
      before: 4,
      spent: 1,
      after: 3,
    });
  });

  it("runs a nested workflow on the shared limiter, budget, and events", async () => {
    let active = 0;
    let peak = 0;
    const worker = fakeAgent<number, number>("worker", async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value;
    });
    const child = workflow({
      meta: { name: "child", description: "child run" },
      body: ({ call, parallel: runParallel }) =>
        runParallel([() => call(worker, 1), () => call(worker, 2)]),
    });
    const events: WorkflowEvent[] = [];
    const definition = workflow({
      meta: { name: "parent", description: "parent run" },
      body: async ({ budget, call }) => {
        const nested = await call.workflow(child);
        return { nested, spent: budget.spent() };
      },
    });

    await expect(runWorkflow(definition, {
      limits: { concurrency: 1 },
      onEvent: (event) => events.push(event),
    })).resolves.toEqual({ nested: [1, 2], spent: 2 });
    expect(peak).toBe(1);
    expect(events.filter((event) => event.type === "log").map((event) => event.message)).toEqual([
      "workflow child started",
      "workflow child finished",
    ]);
  });
});

describe("workflow one-off agents", () => {
  it("runs call.text and call.json against the configured engine", async () => {
    const prompts: string[] = [];
    configureAgent(() => ({
      ask: async (prompt: string) => {
        prompts.push(prompt);
        return prompt.includes("count") ? '{"answer":"pong","count":1}' : '"pong"';
      },
      close: async () => {},
    }));

    const definition = workflow({
      meta: { name: "one-off", description: "text and json" },
      body: async ({ call }) => ({
        text: await call.text("Reply with one word: pong."),
        json: await call.json(
          "Reply with the answer and a count.",
          s.object({ answer: s.string, count: s.int }),
          { label: "answerer" },
        ),
      }),
    });

    await expect(runWorkflow(definition)).resolves.toEqual({
      text: "pong",
      json: { answer: "pong", count: 1 },
    });
    expect(prompts).toHaveLength(2);
  });
});
