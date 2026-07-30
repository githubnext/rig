# Dynamic workflows

Read this reference when deterministic TypeScript should coordinate multiple
typed agents.

## Define and run

Import workflow APIs from `rig`:

```ts
import { agent, s } from "rig";
import { runWorkflow, workflow } from "rig";

const review = agent({
  input: s.object({ file: s.string }),
  output: s.object({ findings: s.array(s.string) }),
  instructions: "Review the requested file.",
});

const audit = workflow({
  meta: {
    name: "audit",
    description: "Review files in parallel",
    phases: ["Review"],
  },
  input: s.object({ files: s.array(s.string) }),
  body: async ({ input, call, phase, pipeline }) => {
    phase("Review");
    return pipeline(input.files, (file) =>
      call(review, { file }, { label: file }));
  },
});

const results = await runWorkflow(audit, {
  args: { files: ["src/a.ts", "src/b.ts"] },
  limits: { concurrency: 8 },
});
```

`meta` describes the workflow for tools and progress displays: `name`,
`description`, optional `phases` (each `"Title"` or `{ title, detail }`), and
optional `whenToUse`. `input` preserves Rig schema inference in both `body` and
`runWorkflow({ args })`.

## Workflow as default export

A `workflow` can be the default export of a rig program. The launcher wraps it
in `runWorkflow` automatically — no manual call is needed:

```ts
import { agent, s, workflow } from "rig";

// Agent role: check one file for linting issues.
const lintFile = agent({
  name: "lintFile",
  model: "nano",
  input: s.object({ file: s.path }),
  output: s.object({ issues: s.array(s.string) }),
  instructions: "Check the file for linting issues.",
});

// Workflow role: lint source files discovered at runtime.
const linter = workflow({
  meta: { name: "linter", description: "Lint TypeScript files in parallel", phases: ["Discover", "Lint"] },
  body: async ({ call, phase, pipeline }) => {
    phase("Discover");
    const raw = await call.text("List TypeScript source files to lint, one path per line.");
    const files = (raw ?? "").split("\n").map((f) => f.trim()).filter(Boolean);
    phase("Lint");
    return pipeline(files, (file) => call(lintFile, { file }, { label: file }));
  },
});

export default linter;
```

- Omit `input` for a no-input program (inline mode) or add `input: s.object({ ... })` for file-mode programs that read stdin JSON.
- Use `agent()` with `agents:` when an LLM should improvise the coordination order. Use `workflow()` when TypeScript owns the orchestration (fan-out, branching, convergence).

## Context

| Member | Behavior |
| --- | --- |
| `input` | Typed workflow arguments |
| `call(worker, input, options?)` | Runs a typed agent; returns its output or `null` on agent failure |
| `call.text(prompt, options?)` | Runs a one-off string-output agent |
| `call.json(prompt, schema, options?)` | Runs a one-off agent constrained to `schema`; returns typed output or `null` |
| `call.workflow(child, args?, options?)` | Runs another workflow inline on the same limiter, budget, and event stream |
| `pipeline(items, ...stages)` | Streams each item through every stage independently; agent calls flow through the shared limiter |
| `parallel(thunks)` | Runs all thunks as a barrier and preserves their order |
| `until(options, step)` | Runs a bounded convergence loop |
| `phase(name)` | Sets the phase attached to subsequent events |
| `log(message)` | Emits a structured log event |
| `budget` | Agent-call meter: `total`, `spent()`, `remaining()` |
| `signal` | Run cancellation signal for non-agent work |

Call options support `label` and `phase` (a per-call phase override) plus the
normal per-call `model`, `timeout`, `maxTurns`, and `signal` overrides.

Each `pipeline` stage receives `(previous, item, index)`. The first stage's
`previous` is the item itself, so a single-stage pipeline is just
`pipeline(items, (item) => ...)`. Stages run per item with no barrier between
them, so one item can be in stage 3 while another is still in stage 1.

`budget` is denominated in agent calls, not tokens: `budget.total` is the
effective `limits.maxAgents`, `spent()` counts started calls, and `remaining()`
is what is left before the run fails. Use it to scale depth:
`while (budget.remaining() > 10) { ... }`.

`call.workflow` runs a child `workflow()` inline. It shares the parent's
concurrency limiter, agent budget, cancellation signal, and `onEvent` stream, and
brackets the child with `log` events. Restore a phase after the nested run if the
child called `phase()`.

`parallel` turns rejected thunks into `null` holes. Agent failures passed through
`pipeline` are already `null` because `call` handles them; other pipeline callback
errors fail the run rather than hiding programming bugs. `WorkflowLimitError` is
never converted to `null`: exceeding `maxAgents` fails the whole run so runaway
scheduling cannot be hidden as an ordinary worker failure. Exceptions thrown
elsewhere in `body` also fail the run.

## Limits

```ts
await runWorkflow(job, {
  args,
  limits: {
    concurrency: 8,
    maxAgents: 500,
    maxWallMs: 45 * 60_000,
    warnAgents: 25,
  },
  signal,
  onEvent: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
});
```

- `concurrency` defaults to the machine parallelism clamped between 2 and 16.
- `maxAgents` defaults to 1,000.
- `warnAgents` defaults to 25 and emits one advisory warning when exceeded.
- `maxWallMs` is optional. When reached, it aborts in-flight calls and fails the run.
- The limiter is shared by all nested primitives and is acquired only by agent
  calls, so nested pipelines do not multiply concurrency or deadlock.

`onEvent` receives `run_start`, `phase_start`, `agent_start`, `agent_done`,
`agent_failed`, `log`, `warning`, `run_done`, and `run_failed`. Event observer
errors never affect the run.

## Convergence

Use `until` instead of an open-ended loop:

```ts
const final = await until(
  { max: 8, noProgressRounds: 2 },
  async (previous, round) => {
    const state = await checkAndFix(previous, round);
    return {
      state,
      done: state.passed,
      progressKey: state.failureSummary,
    };
  },
);
```

The loop stops when `done` is true, after `max` rounds, or after
`noProgressRounds` consecutive equal defined progress keys.

## Porting from Claude dynamic workflows

The rig primitives mirror the Claude Code dynamic-workflow globals (`meta`,
`args`, `agent`, `parallel`, `pipeline`, `phase`, `log`, `budget`, nested
`workflow`). See [Converting Claude dynamic workflows to rig](claude-workflow-conversion.md)
for the full mapping, schema translation table, and behavior differences.
