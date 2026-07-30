# Rig API review: duplication and simplification

This review inventories the public `rig` surface after the addition of Claude
background/dynamic workflow support, identifies duplicate or overlapping APIs,
and proposes simplifications that keep the surface minimal.

Compatibility with Claude dynamic workflows is treated as a hard constraint: a
duplicate that exists *because* Claude injects a primitive under a given name is
classified as intentional and kept. Everything else is a candidate for removal.

Samples are intentionally left untouched — the proposals below are sequenced so
sample rewrites happen in a follow-up PR.

## 1. Surface inventory

| Layer | Members | Notes |
| --- | --- | --- |
| Module exports (`skills/rig/rig.ts`) | 95 `export` statements | 33 runtime values, the rest types |
| Schema helpers (`s.*`) | 24 | 13 primitives/aliases, 6 combinators, 5 constraint presets |
| Prompt helpers (`p.*`) | 17 + callable tag | 11 are prompt *intents*, 6 are formatting helpers |
| `PromptBuilder` methods | 9 | 6 re-expose `p.*` |
| Agent surface | `agent`, `AgentSpec` (11 fields), `CallOptions` (4 fields), `AgentFn` (8 members) | |
| Addons | `steering`, `repair`, `timeout`, `oncePerAgent` + `AgentAddon` middleware | |
| Workflow surface | `workflow`, `runWorkflow`, `call`/`call.text`/`call.json`/`call.workflow`, `pipeline`, `parallel`, `until`, `phase`, `log`, `currentWorkflow`, `budget` | |
| Engines | `copilotEngine`, `configureAgent`, `rig/engines/{anthropic,codex,gemini,pi}`, `RIG_ENGINE` env | |

The schema and prompt layers are where the surface has grown fastest; the
workflow layer is the most recent addition and is largely constrained by Claude
parity.

## 2. Duplication that is intentional (keep)

These pairs look redundant but exist to preserve Claude dynamic-workflow shape.
Removing them would break mechanical porting of `.claude/workflows/*.workflow.js`
scripts, which is the primary reason the workflow layer exists.

| Duplicate | Why it must stay |
| --- | --- |
| `context.{parallel, pipeline, until, phase, log}` **and** module-level `parallel`/`pipeline`/`until`/`phase`/`log` | Claude injects these as sandbox globals. Module-level exports let a half-ported script keep calling `phase()`/`log()` at top level; the context members are the typed, run-scoped form. Both are load-bearing. |
| `call.text(prompt)` / `call.json(prompt, schema)` **and** `agent({...})` + `call(worker, input)` | `call.text`/`call.json` are the 1:1 image of `agent(prompt)` / `agent(prompt, { schema })`. The declared-agent form is rig's own idiom for reuse. Dropping either loses a use case. |
| `CallOptions.model` / `maxTurns` overriding `AgentSpec` fields | Claude call options (`{ model, phase, label }`) are per-call overrides; this is override semantics, not duplication. |
| `budget.total/spent()/remaining()` | Direct Claude parity, even though rig meters agent calls rather than tokens. |

**Recommendation:** document these four explicitly as "intentional parity
duplicates" in `references/claude-workflow-conversion.md` so future reviews do
not try to collapse them.

## 3. Duplication that should be removed

### 3.1 `AgentFn.inputShape` / `AgentFn.outputShape` (dead aliases)

`AgentFn` exposes `inputSchema`/`outputSchema` *and* `inputShape`/`outputShape`
as documented aliases of each other, plus `spec.input`/`spec.output` as a third
path to the same values. The `*Shape` names are a leftover from the removed
shape-descriptor API and have **zero references** anywhere in the repository
outside their own definition.

**Action taken in this PR:** removed. No sample, doc, or test change required.

### 3.2 `s.integer` vs `s.int`

Two names, identical behaviour. Current usage: `s.int` 336 references,
`s.integer` 11.

**Proposal:** keep `s.int`, drop `s.integer`. Requires touching 11 sample/doc
sites — defer to the sample-rewrite PR. Add a lint rule (`prefer-s-int`) with an
autofix so the migration is mechanical.

### 3.3 The `p.*` intent matrix (11 intents → 3 + a reference helper)

This is the largest concentration of duplication. Eleven intents encode only
three operations; the extra names exist purely to vary *where the operand comes
from* (literal, single vs. many, input field, output field):

| Operation | Literal | Many | From input field | Optional/fallback |
| --- | --- | --- | --- | --- |
| read | `p.read` | `p.readAll` | `p.readInput`, `p.readAllInput` | `p.readOptional` |
| write | `p.write` | — | `p.writeInput` | — |
| write generated value | `p.writeOutput` | — | `p.writeInput` | — |
| shell | `p.bash`, `p.bashRaw` | `p.bashEach` | `p.bashEach` | — |

`p.inputField(field)` already exists and returns the string `"input.<field>"`,
i.e. rig already has a (stringly-typed) notion of a deferred reference.

**Proposal:** promote references to first-class values and make the three
operations take them as operands.

- `p.input(field)` — deferred reference to an input field (replaces
  `p.inputField`, and becomes a real value rather than a magic string).
- `p.output(field)` — deferred reference to an output field.
- `p.read(source, options?)` where `source` is a path, an array of paths, or a
  reference — subsumes `read`, `readAll`, `readInput`, `readAllInput`, and with
  `{ optional: true, fallback }` also `readOptional`.
- `p.write(target, content, options?)` where either operand may be a literal or
  a reference — subsumes `write`, `writeOutput`, `writeInput`.
- `p.bash(command, options?)` with `{ each: p.input("field") }` — subsumes
  `bashEach`; `p.bashRaw` stays as the tagged-template escape hatch.

Net effect: 11 intents → 3 intents + 2 reference helpers, with no loss of
expressiveness and a single place to document intent options. The wire format
(`PromptIntent.mode`) can keep its existing modes, so the runtime contract is
unchanged and the change is purely a front-door consolidation.

**Claude impact: none.** Claude dynamic workflows build prompts as plain
strings; `p.*` has no counterpart there, so this layer is free to shrink.

### 3.4 `PromptBuilder` methods that re-expose `p.*`

`PromptBuilder.{bash, bashRaw, read, var, region}` forward to the identical
`p.*` helper, and `PromptBuilder.file(path, contents)` is an undocumented alias
for `p.write` under a different name. `region` additionally exists in two
shapes: `p.region(...)` returns a string, `builder.region(...)` returns `this`.

**Proposal:** keep only the builder-shaped, chainable methods (`write`, `line`,
`region`, `var`, `get`, `toString`) and delete the pass-through methods,
including `file`. Callers use `p.*` directly inside `builder.write(...)`, which
is what every sample already does (`.use(`-style builder chaining and
`builder.file` have no sample usage today).

### 3.5 `p.json(value)` is a no-op wrapper

`renderPromptPart` already serializes objects with `JSON.stringify(value, null, 2)`,
so `${p.json(x)}` and `${x}` produce identical prompt text.

**Proposal:** drop `p.json` and document that objects interpolate as
pretty-printed JSON. 10 references to migrate.

### 3.6 Three ways to configure per-turn timeouts

`CallOptions.timeout`, the `timeout()` addon, and `CallOptions.signal` (with a
caller-built `AbortSignal.timeout`) all express the same thing.

**Proposal:** keep `CallOptions.timeout` and `signal`; drop the `timeout()`
addon. It is the only addon that does not participate in the response cycle — it
just mutates `context.signal` before `next()`, which the call option already
does with less ceremony.

### 3.7 Two ways to attach addons

`AgentSpec.addons` and `AgentFn.use(addons)` do the same thing. `use()` has zero
references in samples and references.

**Proposal:** keep `AgentSpec.addons` as the single, declarative path and remove
`use()`. This also removes the "is the agent still immutable after definition?"
ambiguity that `use()` introduces, and it removes the need for the docs' repeated
caveat that `.use()` accepts *only* addons.

## 4. Growth pressure to watch (no action proposed yet)

- **`s.*` constraint presets.** `nonEmptyString`, `nonEmptyArray`,
  `nonEmptyObject`, `positiveInt`, `nonNegativeInt`, `percent`, `url`, `path`,
  `date` are sugar over `s.string`/`s.number`/`s.array`/`s.record` with one
  constraint. They are individually cheap and all are used, but the pattern
  scales linearly with every new constraint. Prefer adding constraint *options*
  (`s.string({ minLength })`) over new named presets from here on.
- **`s.literal(x)` vs `s.enum(x)`.** `s.literal` is a one-value `s.enum` with a
  narrower inferred type. Keep, but do not add further single-purpose
  constructors in this family.
- **Engine selection has four entry points** (`configureAgent`, `copilotEngine`,
  the `rig/engines/*` subpath exports, and `RIG_ENGINE`/API-key autodetection).
  This is currently justified — the subpath exports keep the core typecheck
  light — but it should be documented as one decision table rather than four
  independent mechanisms.
- **`debug()` is a public export** used mainly by the engine modules. Consider
  demoting it to an internal helper if no program is expected to call it.

## 5. Claude background-workflow compatibility checklist

Every proposal above was checked against the Claude primitive mapping in
`references/claude-workflow-conversion.md`:

| Proposal | Claude primitive affected | Verdict |
| --- | --- | --- |
| Remove `inputShape`/`outputShape` | none | safe |
| Collapse `p.*` intents | none (prompts are strings in Claude) | safe |
| Trim `PromptBuilder` pass-throughs | none | safe |
| Remove `p.json` | none | safe |
| Remove `timeout()` addon | `{ timeoutMs }` maps to `CallOptions.timeout` | safe |
| Remove `AgentFn.use()` | none (Claude has no post-definition mutation) | safe |
| Drop `s.integer` | `{ type: "integer" }` still maps to `s.int` | safe |
| Keep context/module `phase`/`log`/`parallel`/`pipeline`/`until` | globals injected by the sandbox | **must keep both** |
| Keep `call.text`/`call.json` | `agent(prompt)` / `agent(prompt, { schema })` | **must keep** |
| Keep `budget` | `budget.total/spent/remaining` | **must keep** |

Known remaining gaps versus Claude dynamic workflows, unchanged by this review:
`{ effort }` and `{ agentType }` call options are not modeled, and resume
journals, worktree isolation, and human checkpoints are runtime features rather
than API surface.

## 6. Sample audit

All 58 TypeScript samples (`src/samples/*.ts`) and 331 markdown samples
(`skills/rig/samples/*.md`) were audited against the current API.

- **No compilation issues.** `npm run typecheck` is clean, and the extracted
  markdown programs typecheck (`npm run sample --
  --testNamePattern="skill markdown samples typecheck"`). No sample referenced
  the removed `inputShape`/`outputShape` aliases, so no migration was required
  for this PR's deletion.
- **Nine samples were repaired** — defects unrelated to the deletion but found
  while running the suite:
  - `99`, `109`, `113`, `172`, `181`, `182` declared an input on the *root*
    agent, so the launcher refused to run them (`Expected stdin program root
    agent to have no input`). They now source their operands from a delegated
    child agent, a literal, or `p.env`.
  - `174`, `176` imported from `"rig"` twice; merged into a single import.
  - `102` embedded `console.log` inside a `p.bash` snippet; switched to
    `node -p`.
- **Remaining suite failures are the 30-line budget only.** 192 markdown
  samples exceed the per-sample line cap asserted in `scripts/run-sample.test.ts`.
  This predates the review, is not an API problem, and is left for a dedicated
  sample-trimming pass — CI only runs the typecheck portion of the suite.

Intent usage across markdown samples quantifies the migration cost of the §3.3
consolidation:

| Intent | Uses | Post-consolidation form |
| --- | --- | --- |
| `p.bash` | 300 | unchanged |
| `p.readOptional` | 57 | `p.read(path, { optional: true, fallback })` |
| `p.read` | 29 | unchanged |
| `p.readInput` | 26 | `p.read(p.input(field))` |
| `p.writeOutput` | 18 | `p.write(path, p.output(field))` |
| `p.write` | 15 | unchanged |
| `p.writeInput` | 3 | `p.write(p.input(field), p.output(field))` |
| `p.bashEach` | 2 | `p.bash(template, { each: p.input(field) })` |
| `p.readAll` / `p.readAllInput` | 0 | `p.read([...])` / `p.read(p.input(field))` |

Roughly 110 call sites change, all mechanically — which supports doing the
migration as one lint-autofixed PR rather than by hand.

## 7. Suggested sequencing

1. **This PR** — the review, removal of the dead `inputShape`/`outputShape`
   aliases (no sample impact), and the nine unrelated sample repairs from §6.
2. **Next PR** — additive consolidation: introduce `p.input`/`p.output` and the
   unified `p.read`/`p.write`/`p.bash` signatures alongside the existing intents,
   with lint rules and autofixes.
3. **Follow-up PR** — mechanical sample and reference migration driven by the
   lint autofixes, then delete the superseded intents, `p.json`, `p.inputField`,
   `s.integer`, `timeout()`, `AgentFn.use()`, and the `PromptBuilder`
   pass-throughs.

Staging it this way keeps every intermediate commit green and confines sample
churn to a single reviewable PR.

## 8. Related references

- [Converting Claude dynamic workflows to rig](../skills/rig/references/claude-workflow-conversion.md)
- [Dynamic workflows](../skills/rig/references/dynamic-workflows.md)
- [Agent API and schemas](../skills/rig/references/agent-api.md)
- [Prompt intents](../skills/rig/references/prompt-intents.md)
