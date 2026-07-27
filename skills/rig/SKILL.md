# rig

Minimal TypeScript harness for structured agents in sandboxed workflows and runnable `rig` markdown fences.

## Install

```bash
npm install github:githubnext/rig#v0.0.8
# or install as a Copilot coding agent skill
gh skills clone githubnext/rig
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

1. Use one `import { ... } from "rig"` statement (including addons such as `repair`/`steering`) and `agent({ ... })`; add a `// Agent role: ...` comment above every agent.
2. Set examples to `model: "large"`, `"mini"`, or `"nano"`.
3. Omit `input` and `output` when the default free-form `s.string` schemas are enough; otherwise use explicit `s.*` schemas.
4. Put known workspace context directly in `p\`...\`` with `${p.read(...)}` or `${p.bash(...)}`. Add `input` only for values supplied by the caller.
5. Keep outputs small and strict; prefer enums, literals, paths, and integers when they express the contract.
6. Add named `agents` only when the task benefits from delegation.
7. Export exactly one root value. Do not call the root agent or print its result in generated snippets.

## Put settings in the right place

| Concern | Location | Addon args |
|---------|----------|------------|
| `name`, `instructions`, `input`, `output`, tools, stable `model`/`maxTurns` | `agent({ ... })` | n/a |
| Per-run `model`, `maxTurns`, `timeout`, `signal` | `myAgent(input, { ... })` | n/a |
| Stable addons | `addons` in the spec | `steering({ message? })`, `timeout({ timeout })`, `repair()` (no args) |
| Additional addons | `agent.use(addon)` | Same signatures as spec addons |

Defaults are model `small`, `maxTurns: 4`, no addons, and name `"agent"`. `agent.use()` accepts only addons.

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

Use `s.int`/`s.integer` for integer-valued fields (counts, indices, line numbers); `s.number` for floats or measured values. Use `s.path` for file-system paths — especially input fields read with `p.readInput` — rather than `s.string`.
Use `s.optional(shape)` when a field may be omitted and `s.nullable(shape)` when the field should be present but can be `null`. Use `s.record(value)` for string-keyed maps such as `s.record(s.number)` for per-file or per-symbol counters. `s.record(...)` is also valid as the root `output` — `output: s.record(s.number)` is correct when the agent returns a map; wrapping it in `s.object` is unnecessary. `s.record(...)` is also valid as a nested field, for example `output: s.object({ files: s.record(s.object({ owner: s.string })), categorySummary: s.record(s.int) })`.
For link/file lists, keep the scalar helpers inside the item object — for example `s.array(s.object({ url: s.url, file: s.optional(s.path), httpCode: s.optional(s.int) }))`.

## Choose prompt intents by data source

`p.*` values are declarative prompt instructions, not in-process file or shell operations.

| Source or effect | Use |
|------------------|-----|
| Shell command | `p.bash(command)` |
| Shell command with literal backslashes | ``p.bashRaw`command` `` |
| Same command run once per element in an input array | `p.bashEach(template, inputArrayField)` — use `{}` as the element placeholder |
| Known required/optional file | `p.read(path)` / `p.readOptional(path, fallback?)` |
| Several known files | `p.readAll(paths)` |
| Single path supplied in an input field | `p.readInput(field)` |
| Array of paths supplied in an input field | `p.readAllInput(field)` |
| Workspace discovery | `p.glob(pattern)` |
| Environment or structured inline data | `p.env(name, fallback?)` / `p.json(value)` |
| Reference an input field value in prose | `p.inputField(field)` |
| Write content known while building the prompt | `p.write(path, content)` |
| Write an LLM-generated output field to a static path | `p.writeOutput(field, path)` |
| Write an LLM-generated output field to a caller-supplied path | `p.writeInput(inputPathField, contentOutputField)` |

Prefer:

```ts
instructions: p`Review ${p.read("README.md")} against ${p.bash("git status --short")}.`
```

Do not replace file intents with `cat` commands or large in-memory strings. `p.readOptional(path, fallback?)` injects the fallback text directly into prompt context when the file is absent — for example, `p.readOptional(".nvmrc", "20")` injects `"20"` when the file is missing. `p.write` does not return a path; `p.writeOutput(field, path)` writes the named output field to a static path after generation — the first argument must exactly match an output schema field name (e.g., `p.writeOutput("report", "out.md")` paired with `output: s.object({ report: s.string })`). Use `p.writeInput("outputPath", "rendered")` instead when the caller supplies the destination path in `input.outputPath`. `p.readAll(paths)` accepts a known path list, not a glob pattern. `p.readInput(field)` reads the file at a **single** path held in the named input field; `p.readAllInput(field)` reads all files at the paths in an input array field and concatenates their contents — use it instead of prose-based iteration instructions when the input is a `s.array(s.path)` field. `p.bash` and `p.bashRaw` accept only static strings; when the **same command must run once per element** in a caller-supplied array, use `p.bashEach(template, field)` with `{}` as the element placeholder; for commands that depend on multiple fields or require branching, describe the iteration in prose and reference `input.<field>` by name — use `p.inputField(field)` to reference a non-path input value explicitly in prose instead of the opaque `${"input.field"}` literal.
For `p.readOptional` fallbacks, pass a value the model can parse in context (for example `"{}"` when downstream instructions expect JSON). Multiple shell intents can be composed in one template expression, such as `p\`Check ${p.bash("node -v")} and ${p.bash("npm -v")}.\``.

- Use `p.readOptional("tsconfig.json", "{}")` when later instructions expect JSON rather than free-form text.
- Use `p.writeOutput("report", "out.md")` only when `output` declares a `report` field with that exact name.
- Anti-example: `instructions: p\`${p.writeOutput("summary", "out.md")}\`` is invalid when `output` is `s.object({ report: s.string })`; the field name must match exactly.

## Tools, composition, and reliability

- Define tools with `defineTool(name, { description, parameters: s.object(...), handler })`; schema-based handler arguments are inferred and tools default to `skipPermission: true`. Never use positional arguments such as `defineTool(name, description, parameters, result, handler)` — Rig only accepts the two-argument config form:
  ```ts
  const lookupIssue = defineTool("lookup_issue", {
    description: "Look up an issue by id.",
    parameters: s.object({ issue: s.string }),
    handler: async ({ issue }) => ({ issue, status: "open" }),
  });
  ```
  `s.unknown` is valid in tool parameters when the tool needs to compare or echo arbitrary JSON-like values, for example `parameters: s.object({ currentValue: s.unknown, recommendedValue: s.unknown })`. Handlers can be sync or async and return a string or any JSON-serializable value; return plain JS values (do not `JSON.stringify`) because Rig serializes non-string results automatically. Async handlers may import Node built-ins with `await import("node:child_process")`. Destructure only handler fields you use. Use `defineTool` for external operations and deterministic transforms that support reasoning — not to replace the core classification or judgment step with in-process TypeScript logic.
- `agents` must be a named object — `agents: { extractor }` — never an array (`agents: [extractor]` is a type error). Attach every declared subagent to the exported root's graph.
- There is no chain or loop primitive; give the coordinator explicit delegation instructions and require one combined output.
- Automatic parse/schema repair uses `repair()` from `rig`; `repair()` takes no arguments. Put retries on the agent spec: `maxTurns: 3, addons: repair()`. Do not pass retries to `repair()` (`addons: repair({ maxTurns: 3 })` is invalid).
- `addons` accepts a single addon or an array. Use `addons: repair()` for one addon, and `addons: [steering(), repair()]` when combining. **`steering()` must come before `repair()` in the array** — write `[steering(), repair()]`, not `[repair(), steering()]`. `steering()` (default warning) or `steering({ message: "..." })` (custom text) should run before `repair()` to append a last-chance instruction on the final retry. `oncePerAgent(callback)` invokes the callback once per runtime agent instance — its internal `WeakSet` already deduplicates, so no external tracking is needed.

## Runnable markdown

When asked for a runnable markdown example, emit exactly one fenced `rig` block containing one default-exported, no-input root program. Inline mode may omit the rig import intentionally; never invoke the root inside the fence.

Typecheck without executing:

```bash
cat program.ts | node skills/rig/rig.ts --typecheck
```

Lint a generated program before running it:

```bash
node skills/rig/eslint/lint.js program.ts
```

Run inline input or a program file with `node skills/rig/rig.ts`; add `--server` to start the Copilot server. Assume Node.js 24, prefer native APIs, and use `google/zx` for shell-style TypeScript automation.

## Agentic Workflows

To run a fenced Rig program in a GitHub Agentic Workflow:

```yaml
engine:
  id: copilot
  copilot-sdk: true
skills:
  - githubnext/rig/skills/rig/SKILL.md@<full-commit-sha>
```

Import `configureAgent` and `copilotEngine` in the fenced program and call
`configureAgent(copilotEngine())` before defining agents. Pin the skill to an
immutable commit, grant `copilot-requests: write`, and enable only the tools and
network access used by the program. Edit workflows with an agent or run
`gh aw compile --watch` for immediate feedback, then run
`gh aw compile <workflow-id> --strict` and commit the generated `.lock.yml`.

## Final checks

- Known context uses `p.*`; true runtime data uses `input`.
- Important outputs are explicitly typed and constrained.
- Every helper and import uses the current `rig` API.
- Generated TypeScript passes `node skills/rig/eslint/lint.js <program.ts>` and typechecking.
- Every subagent is named, reachable, and narrowly scoped.
- Snippets have one default export and no `console.log`.
- No deprecated hooks or compatibility layers were introduced.
- Root `output` is `s.record(...)` for map returns; do not wrap it in an extra `s.object`.

## Focused references

Read only the reference needed for the current task:

- [Agent API and schemas](references/agent-api.md) — spec fields, schema overloads, tools, and call-time options.
- [Prompt intents](references/prompt-intents.md) — helper semantics, writes, dynamic paths, and failures.
- [Composition and addons](references/composition.md) — subagents, coordinator patterns, repair, and addon lifecycle.
- [Linting](references/linting.md) — custom Rig ESLint rules, fixes, and rule scaffolding.
- [Running and engines](references/runtime.md) — inline/file launch modes, typechecking, stdin coercion, and SDK adapters.
