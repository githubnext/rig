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

## Top-level constructs in agent programs

The launcher runs every program inside a workflow run, including programs whose
root export is an `agent`, a string, or a prompt builder. Module evaluation
happens inside that run, so `phase()` and `log()` imported from `rig` work at the
program's top level without declaring a `workflow()`:

```ts
import { agent, log, phase } from "rig";

phase("Review");
log("reviewing the staged diff");

export default agent({ instructions: "Review the staged diff." });
```

`currentWorkflow()` returns the active run context (`call`, `budget`, `signal`,
`phase`, `log`) or `undefined` outside a run; `phase()` and `log()` are no-ops
outside a run. A `workflow()` default export is nested into the same run, so it
shares the launcher's limiter, budget, and event stream instead of starting a
second run.

To use `call`, `pipeline`, and `parallel` at module scope without destructuring
from `body`, import them from `"rig/globals"`:

```ts
import { call, pipeline } from "rig/globals";
```

These are ambient proxies that delegate to the active workflow context
automatically.  They throw if no workflow run is active.  Prefer explicit
`body({ call })` destructuring inside `workflow()` bodies and reserve
`"rig/globals"` for top-level launcher programs ported from Claude dynamic
workflows.  Do not import `"rig/globals"` unless you need it.

## Context

| Member | Behavior |
| --- | --- |
| `input` | Typed workflow arguments |
| `call(worker, input, options?)` | Runs a typed agent; returns its output or `null` on agent failure |
| `call.text(prompt, options?)` | Runs a one-off string-output agent |
| `call.json(prompt, schema, options?)` | Runs a one-off agent constrained to `schema`; returns typed output or `null` |
| `call.workflow(child, args?, options?)` | Runs another workflow inline on the same limiter, budget, and event stream |
| `pipeline(items, ...stages)` | Streams each item through every stage independently; agent calls flow through the shared limiter |
| `parallel(thunks)` | Runs all thunks as a barrier and preserves their order. **TypeScript:** all thunks must return the same type; for heterogeneous outputs cast: `parallel<TypeA \| TypeB>([...]) as Promise<[TypeA \| null, TypeB \| null]>`. Use instead of `Promise.all` — it respects the concurrency limiter and converts failures to `null` holes. |
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
`pipeline` are already `null` because `call` handles them. When a `pipeline`
stage returns `null`, subsequent stages for that item are skipped and `null`
propagates to the output — this prevents passing a failed result to the next
stage. Other pipeline callback errors fail the run rather than hiding programming
bugs. `WorkflowLimitError` is never converted to `null`: exceeding `maxAgents`
fails the whole run so runaway scheduling cannot be hidden as an ordinary worker
failure. Exceptions thrown elsewhere in `body` also fail the run.

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

## Example programs

These samples in `skills/rig/samples/` are direct ports of common Claude dynamic
workflow patterns — use them as starting points when converting a script:

| Sample | Demonstrates |
| --- | --- |
| [340-flat-workflow-port.md](../samples/340-flat-workflow-port.md) | Flat/top-level script port using `"rig/globals"` ambient `call`/`pipeline` — minimal-change first step when porting a Claude flat workflow |
| [310-workflow-audit-verify.md](../samples/310-workflow-audit-verify.md) | `args`→`input`, `parallel`, `pipeline`, `phase`, `call.json` — mirrors the canonical find-and-verify pattern |
| [320-budget-aware-crawler.md](../samples/320-budget-aware-crawler.md) | `log`, `budget.remaining()`, `until` convergence loop |
| [330-nested-workflow-composition.md](../samples/330-nested-workflow-composition.md) | `call.workflow` (rig equivalent of `workflow(ref, args)`) sharing the parent's limiter and budget |
| [360-parallel-branch-analysis-workflow.md](../samples/360-parallel-branch-analysis-workflow.md) | `parallel(thunks)` as a barrier — use instead of `Promise.all` when porting |
| [401-multi-stage-pipeline-workflow.md](../samples/401-multi-stage-pipeline-workflow.md) | Multi-stage `pipeline(items, stage1, stage2)` enrichment chain — stage `(prev, item, index)` vs Claude's `(item, index)` |
| [411-anthropic-engine-workflow.md](../samples/411-anthropic-engine-workflow.md) | `anthropicEngine()` setup + per-call Claude model tier selection (`claude-haiku-3-5` / `claude-sonnet-4-5`) — final step when running a rig port against Claude |
