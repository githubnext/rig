# Converting Claude dynamic workflows to rig

Read this reference when porting a Claude Code dynamic workflow script
(`.claude/workflows/*.workflow.js`) to a rig `workflow()` program, or when
comparing the two API surfaces.

A dynamic workflow is a sandboxed JavaScript module that exports a literal
`meta`, reads `args`, and orchestrates subagents with injected globals
(`agent`, `parallel`, `pipeline`, `phase`, `log`, `budget`). rig covers the same
shape with a typed `workflow({ meta, input, body })` whose `body` receives those
primitives from its context instead of from globals.

## Primitive mapping

| Dynamic workflow | rig | Notes |
| --- | --- | --- |
| `export const meta = { name, description, phases, whenToUse }` | `workflow({ meta: { name, description, phases, whenToUse } })` | `phases` accepts `"Title"` or `{ title, detail }`; `meta` may reference variables |
| `args` (JSON string or object) | `input` schema + `context.input` | Parsed and validated by the launcher; no defensive `JSON.parse` |
| `await agent(prompt)` | `await call.text(prompt, options?)` | Returns `string \| null` |
| `await agent(prompt, { schema })` | `await call.json(prompt, schema, options?)` | `schema` is any `s.*` value (`s.object`, `s.enum`, `s.array`, …); result is typed and validated. Claude workflows only support object schemas; rig accepts any schema type. |
| Reused prompt + schema pair | `agent({ input, output, instructions })` then `call(worker, input, options?)` | Preferred for anything invoked more than once |
| `parallel(thunks)` | `parallel(thunks)` | Same barrier semantics; failures become `null` holes |
| `pipeline(items, ...stages)` | `pipeline(items, ...stages)` | Stages receive `(previous, item, index)`; the first stage's `previous` is the item |
| `phase(title)` | `phase(title)` | Same |
| `{ phase: "Verify" }` on a call | `{ phase: "Verify" }` in call options | Overrides the ambient phase for that call only |
| `{ label: "verify:x" }` | `{ label: "verify:x" }` | Appears in `agent_start`/`agent_done` events |
| `{ model: "sonnet" }` | `{ model: "sonnet" }` | rig passes the id straight to the engine; use a full Claude model ID (e.g. `"claude-sonnet-4-5"`) when running with `anthropicEngine()` |
| `{ effort: "high" }` | use a more capable model id or increase `maxTurns` | no `effort` option; prefer `model: "claude-opus-4-5"` over `"claude-haiku-3-5"` when quality matters |
| `{ agentType: "Explore" }` | Prompt wording plus a narrow `tools` list | rig has no built-in read-only agent type |
| `{ timeoutMs }` / `{ retries }` | `{ timeout }` on the call; `maxTurns` + `repair()` on the agent | rig retries are turn-based, not process-based |
| `log(message)` | `log(message)` | Same |
| `budget.total / spent() / remaining()` | `budget.total / spent() / remaining()` | rig meters **agent calls** (`limits.maxAgents`), not tokens |
| `workflow(ref, args)` | `call.workflow(child, args, options?)` | Shares the limiter, budget, phase, and event stream |
| open-ended `while` convergence loop | `until({ max, noProgressRounds }, step)` | Bounded; stops on `done`, after `max` rounds, or after `noProgressRounds` equal progress keys — prefer over unbounded loops |
| top-level `return value` | `return value` from `body` | Same |
| `Workflow({ scriptPath, args })` from a session | `cat args.json \| node skills/rig/rig.ts program.ts` | See [runtime](runtime.md) |

Globals such as `phase` and `log` also exist as module-level imports from `rig`.
The launcher runs every program — including one whose root export is an `agent` —
inside a workflow run, so a partially ported script can call `phase()` and `log()`
at top level before the orchestration itself moves into `workflow({ body })`.

For flat scripts that use `call`, `pipeline`, or `parallel` at the top level
(the Claude dynamic workflow style), import those from `"rig/globals"`:

```ts
import { call, parallel, pipeline } from "rig/globals";
import { phase, log, workflow, s } from "rig";

// Flat Claude-style code: runs inside the launcher's workflow context
phase("Find");
const result = await call.json("List issues.", s.object({ issues: s.array(s.string) }));
log(`found ${result?.issues.length ?? 0} issues`);

export default workflow({ meta: { name: "flat-port", description: "direct port" },
  body: async () => result });
```

The `rig/globals` proxies route through whatever workflow run is active.
They throw if called outside a run. Import from `"rig/globals"` only in
top-level launcher programs ported from flat scripts; prefer explicit
`body({ call })` destructuring inside `workflow()` bodies.

## Schema conversion

Dynamic workflows pass OpenAI-strict JSON Schema literals. rig schemas are
`s.*` values that compile to the same JSON Schema, so conversion is mechanical:

| JSON Schema | rig |
| --- | --- |
| `{ type: "string" }` | `s.string` |
| `{ type: "string", description: "d" }` | `s.string("d")` |
| `{ type: "number" }` | `s.number` |
| `{ type: "number", description: "d" }` | `s.number("d")` |
| `{ type: "integer" }` | `s.int` |
| `{ type: "boolean" }` | `s.boolean` |
| `{ type: "string", enum: [...] }` | `s.enum("a", "b")` |
| `{ type: "string", const: "done" }` | `s.literal("done")` |
| `{ type: "array", items: X }` | `s.array(X)` |
| `{ type: "object", properties, required, additionalProperties: false }` | `s.object({ ... })` |
| `{ anyOf: [X, { type: "null" }] }` | `s.nullable(X)` |
| omitted from `required` | `s.optional(X)` |

`additionalProperties: false` and a full `required` list are implicit in
`s.object`, so drop them. Use `s.path` for file paths and `s.url` for URIs.

## Worked conversion

Original dynamic workflow:

```js
export const meta = {
  name: 'audit',
  description: 'Find and verify issues',
  phases: [{ title: 'Find' }, { title: 'Verify' }],
}

const FINDINGS = {
  type: 'object', additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'file'],
      properties: { title: { type: 'string' }, file: { type: 'string' } },
    } },
  },
}

phase('Find')
const found = await parallel(args.areas.map((area) => () =>
  agent(`Audit ${area}. Report findings.`, { label: area, schema: FINDINGS })))

phase('Verify')
const verified = await pipeline(
  found.filter(Boolean).flatMap((r) => r.findings),
  (finding) => agent(`Verify: ${finding.title} in ${finding.file}.`, {
    phase: 'Verify', schema: VERDICT,
  }),
)
return verified.filter(Boolean).filter((v) => v.real)
```

Ported to rig:

```ts
import { s, workflow } from "rig";

const finding = s.object({ title: s.string, file: s.path });

// Workflow role: audit areas in parallel, then verify each finding.
const audit = workflow({
  meta: {
    name: "audit",
    description: "Find and verify issues",
    phases: [{ title: "Find" }, { title: "Verify", detail: "one verifier per finding" }],
  },
  input: s.object({ areas: s.array(s.string) }),
  body: async ({ call, input, parallel, phase, pipeline }) => {
    phase("Find");
    const found = await parallel(input.areas.map((area) => () =>
      call.json(`Audit ${area}. Report findings.`, s.object({ findings: s.array(finding) }), { label: area })));

    phase("Verify");
    const verified = await pipeline(
      found.flatMap((result) => result?.findings ?? []),
      (f: { title: string; file: string }) =>
        call.json(`Verify: ${f.title} in ${f.file}.`, s.object({ real: s.boolean }), { phase: "Verify" }),
    );
    return verified.filter((v) => v?.real);
  },
});

export default audit;
```

## Running with the Anthropic engine (Claude models)

Claude dynamic workflows run on Claude by default. To run a rig workflow on
Claude, register `anthropicEngine()` and pass the full model ID:

```ts
import { configureAgent } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";

configureAgent(anthropicEngine()); // reads ANTHROPIC_API_KEY
```

Or set `RIG_ENGINE=anthropic` to let the launcher auto-select based on
`ANTHROPIC_API_KEY`, then specify the model in the agent or at the call site:

```ts
import { agent, s, workflow } from "rig";

// Agent role: classify priority using a more capable Claude model for accuracy.
const classifier = agent({
  model: "claude-sonnet-4-5",
  input: s.object({ text: s.string }),
  output: s.object({ priority: s.enum("high", "medium", "low") }),
  instructions: "Classify the priority of the given text.",
});

// Per-call model override — equivalent to { model: "claude-opus-4-5" } in a dynamic workflow:
const result = await call(classifier, { text }, { model: "claude-opus-4-5" });
```

rig passes the model id string directly to the SDK without normalization, so
any model id accepted by the Anthropic API is valid. Common ids:

| Intent | Claude model id |
| --- | --- |
| Fast / low-cost | `"claude-haiku-3-5"` |
| Balanced | `"claude-sonnet-4-5"` |
| Most capable | `"claude-opus-4-5"` |

Use the `model` field on `agent({ model })` for a stable default, or override
per call with `call(agent, input, { model })`. There is no global `effort` knob;
pick a model tier that matches the task's quality requirement.

## Behavior differences to keep in mind

- **Failure holes.** `call` returns `null` when an agent fails, and `parallel`
  turns rejected thunks into `null`. A rig `pipeline` stage that throws fails the
  whole run instead of dropping that item to `null`, so programming bugs stay
  visible; wrap a stage in `try`/`catch` when you want the Claude behavior.
- **Budget units.** rig counts agent calls, not tokens, so guard loops with
  `budget.remaining() > n` where `n` is a call count.
- **Nesting depth.** `call.workflow` has no one-level restriction, but it shares
  the parent's `maxAgents` and concurrency, so a nested run cannot escape the
  parent's limits.
- **Richer schema types.** Claude workflows only support object schemas in `agent(prompt, { schema })`; rig's `call.json(prompt, schema)` accepts any `s.*` schema — `s.enum`, `s.array`, `s.string`, or any nested combination — and infers the TypeScript return type automatically.
- **No sandbox restrictions.** rig programs are normal TypeScript modules:
  `Date.now()`, imports, and Node built-ins are allowed, and the launcher owns
  isolation instead of the runtime.
- **No resume journal, worktree isolation, or human checkpoints.** These are
  runtime features of Claude Code, not API surface; a rig workflow that needs a
  human decision should return a structured `needs_human` result and be re-run
  with the answer in its input.

## Incremental migration with rig/globals

When doing a first-pass port, keep the flat module structure by importing
`call`, `pipeline`, and `parallel` from `"rig/globals"` instead of
destructuring them from `workflow({ body })`. The launcher runs every program
inside a workflow context, so ambient calls are live at module top level:

```ts
import { agent, phase, log, s } from "rig";
import { call, pipeline } from "rig/globals";

// Agent role: summarize one file.
const summarize = agent({
  model: "small",
  input: s.object({ file: s.path }),
  output: s.object({ summary: s.string }),
  instructions: "Summarize the file.",
});

phase("Discover");
log("listing source files");
const raw = await call.text("List TypeScript source files, one per line.");
const files = (raw ?? "").split("\n").map((f) => f.trim()).filter(Boolean);

phase("Summarize");
const summaries = await pipeline(files, (file) => call(summarize, { file }, { label: file }));
export default summaries;
```

Move `call` and `pipeline` calls inside `workflow({ body })` once the port is
stable — it enables unit testing and makes input typing explicit.
`"rig/globals"` is a stepping stone, not a final form.

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

## Related references

- [Dynamic workflows](dynamic-workflows.md) — full rig workflow API.
- [Agent API and schemas](agent-api.md) — `s.*` helpers and call options.
- [Running and engines](runtime.md) — launching a workflow program.
