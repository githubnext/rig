# rig

Minimal TypeScript harness for structured agents in sandboxed workflows and runnable `rig` markdown fences.

## Install

```bash
npm install github:pelikhan/rig#v0.0.8
# or install as a Copilot coding agent skill
gh skills clone pelikhan/rig
```

## Default program

```ts
import { agent, p, s } from "rig";

// Agent role: review the diff and return only the declared output.
const reviewDiff = agent({
  model: "mini",
  instructions: p`Review ${p.bash("git diff -- .")} and return only the declared output.`,
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
    findings: s.array(s.object({
      file: s.path,
      message: s.string,
      line: s.optional(s.int),
    })),
  }),
});

export default reviewDiff;
```

## Construction rules

1. Use one `import { ... } from "rig"` statement and `agent({ ... })`; add a `// Agent role: ...` comment above every agent.
2. Set examples to `model: "large"`, `"mini"`, or `"nano"`.
3. Omit `input` and `output` when the default free-form `s.string` schemas are enough; otherwise use explicit `s.*` schemas.
4. Put known workspace context directly in `p\`...\`` with `${p.read(...)}` or `${p.bash(...)}`. Add `input` only for values supplied by the caller.
5. Keep outputs small and strict; prefer enums, literals, paths, and integers when they express the contract.
6. Add named `agents` only when the task benefits from delegation.
7. Export exactly one root value. Do not call the root agent or print its result in generated snippets.

## Put settings in the right place

| Concern | Location |
|---------|----------|
| `name`, `instructions`, `input`, `output`, tools, stable `model`/`maxTurns` | `agent({ ... })` |
| Per-run `model`, `maxTurns`, `timeout`, `signal` | `myAgent(input, { ... })` |
| Stable addons | `addons` in the spec |
| Additional addons | `agent.use(addon)` |

Defaults are model `gpt-4.1`, `maxTurns: 4`, no addons, and name `"agent"`. `agent.use()` accepts only addons.

## Choose schemas deliberately

| Need | Helper |
|------|--------|
| Text, non-empty text, URL, path | `s.string`, `s.nonEmptyString`, `s.url`, `s.path` |
| Number, integer, boolean, unknown | `s.number`, `s.integer`/`s.int`, `s.boolean`, `s.unknown` |
| Array, non-empty array | `s.array(item)`, `s.nonEmptyArray(item)` |
| Object, record, non-empty record | `s.object(fields)`, `s.record(value)`, `s.nonEmptyObject(value)` |
| Fixed choices or exact value | `s.enum(...)`, `s.literal(value)` |
| Optional or nullable value | `s.optional(shape)`, `s.nullable(shape)` |

Descriptions go first for scalar helpers, second after the shape for containers, and last for enums/literals. Schemas serialize directly as JSON Schema; do not invent alternate schema syntax.

## Choose prompt intents by data source

`p.*` values are declarative prompt instructions, not in-process file or shell operations.

| Source or effect | Use |
|------------------|-----|
| Shell command | `p.bash(command)` |
| Shell command with literal backslashes | ``p.bashRaw`command` `` |
| Known required/optional file | `p.read(path)` / `p.readOptional(path, fallback?)` |
| Several known files | `p.readAll(paths)` |
| Path supplied in an input field | `p.readInput(field)` |
| Workspace discovery | `p.glob(pattern)` |
| Environment or structured inline data | `p.env(name, fallback?)` / `p.json(value)` |
| Write content known while building the prompt | `p.write(path, content)` |
| Write an LLM-generated output field | `p.writeOutput(field, path)` |

Prefer:

```ts
instructions: p`Review ${p.read("README.md")} against ${p.bash("git status --short")}.`
```

Do not replace file intents with `cat` commands or large in-memory strings. `p.write` does not return a path; `p.writeOutput` requires a matching output-schema field.

## Tools, composition, and reliability

- Define tools with `defineTool(name, { description, parameters: s.object(...), handler })`; schema-based handler arguments are inferred and tools default to `skipPermission: true`.
- `agents` is a named object such as `agents: { extractor }`, never an array. Attach every declared subagent to the exported root's graph.
- There is no chain or loop primitive; give the coordinator explicit delegation instructions and require one combined output.
- Automatic parse/schema repair requires `repair` from `rig/addons`; `maxTurns` alone only sets the total turn budget.
- Put `steering()` after `repair` when adding a final-turn warning. Use `oncePerAgent()` for one registration callback per runtime agent.

## Runnable markdown

When asked for a runnable markdown example, emit exactly one fenced `rig` block containing one default-exported, no-input root program. Inline mode may omit the rig import intentionally; never invoke the root inside the fence.

Typecheck without executing:

```bash
cat program.ts | node skills/rig/rig.ts --typecheck
```

Run inline input or a program file with `node skills/rig/rig.ts`; add `--server` to start the Copilot server. Assume Node.js 24, prefer native APIs, and use `google/zx` for shell-style TypeScript automation.

## Final checks

- Known context uses `p.*`; true runtime data uses `input`.
- Important outputs are explicitly typed and constrained.
- Every helper and import uses the current `rig` or `rig/addons` API.
- Every subagent is named, reachable, and narrowly scoped.
- Snippets have one default export and no `console.log`.
- No deprecated hooks or compatibility layers were introduced.

## Focused references

Read only the reference needed for the current task:

- [Agent API and schemas](references/agent-api.md) — spec fields, schema overloads, tools, and call-time options.
- [Prompt intents](references/prompt-intents.md) — helper semantics, writes, dynamic paths, and failures.
- [Composition and addons](references/composition.md) — subagents, coordinator patterns, repair, and addon lifecycle.
- [Running and engines](references/runtime.md) — inline/file launch modes, typechecking, stdin coercion, and SDK adapters.
