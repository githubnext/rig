# rig

Minimal TypeScript agent harness skill for structured agent calls inside sandboxed agentic workflows, intended for embedding in markdown with `rig` code fences.

## Install

Install the latest GitHub release directly:

```bash
npm install github:pelikhan/rig#v0.0.8
```

Or clone the skill for Copilot coding agent:

```bash
gh skills clone pelikhan/rig
```

## Preferred imports

```ts
import { agent, p, s } from "rig";
```

## Recommended default pattern

Prefer this shape when generating a new rig program:

```ts
import { agent, p, s } from "rig";

// Agent role: review the diff and return only the declared output.
const reviewDiff = agent({
  model: "mini",
  instructions: "Review the diff and return only the declared output.",
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
    findings: s.array(s.object({
      file: s.string,
      message: s.string,
      line: s.optional(s.number),
    })),
  }),
});

export default reviewDiff;
```

## Fast generation checklist

Use this checklist before finalizing generated code:

1. Use a single `import { ... } from "rig"` statement.
2. Use `agent({ ... })`; include `name` when it helps differentiate agents, keep `instructions` and `output` explicit, and include `input` when the scenario needs it.
3. Define input/output with `s.object(...)` and explicit `s.*` helpers.
4. Keep output schema strict (enums/literals for constrained values).
5. Add a `// Agent role: ...` comment above each agent declaration.
6. Set `model` explicitly to `"large"`, `"mini"`, or `"nano"`.
7. Prefer `${p.read(...)}` / `${p.bash(...)}` inside `p\`\`` templates when the context source is already known; add input fields only for true caller-provided data.
8. Put stable defaults in spec; register addons in spec or with `agent.use(...)`.
9. Add `agents` only when required by the scenario.
10. Avoid `console.log(...)` in snippets.
11. For inline markdown skill mode, export exactly one default root agent with no input and do not call it directly.
12. Assume Node.js 24 runtime for operational examples and generated snippets.
13. For bash-like operations from TypeScript, prefer `google/zx` (`import { $ } from "zx"`).
14. Prefer Node.js native APIs (for example built-in `fetch` and native glob support) over extra helper dependencies.

## Canonical construction order

Use this order to reduce syntax drift:

1. Core agent shape: `agent({ name, instructions, input, output })`.
2. Explicit typed schemas with `s.object(...)` and `s.*`.
3. Shell/file context with `p\`\`` and `${p.*}` before adding extra input plumbing.
4. Advanced spec fields (`agents`) when scenario needs them.
5. Invocation overrides (`model`, `timeout`, `maxTurns`, `signal`) at call time.

## `agent(spec)`

Declare a structured agent.

### Spec fields

| Field | Purpose |
|-------|---------|
| `name` | Agent name used in the prompt |
| `instructions` | Prompt instructions as a plain string or a ``p`...` `` prompt builder |
| `input` | Input schema |
| `output` | Output schema |
| `model` | Default model name; examples should use `"large"`, `"mini"`, or `"nano"` |
| `maxTurns` | Retry budget for invalid JSON or invalid output |
| `addons` | Per-turn addons for steering, validation, and retry customization |
| `agents` | Optional named subagents exposed to the harness |

Use `agent({ name, ... })` as the only agent declaration form. `name` is optional; when omitted rig normalizes it to `"agent"`.

### Where each setting belongs

| Setting | Spec (`agent({...})`) | Call-time (`myAgent(input, {...})`) | `.use(addon)` |
|---------|-----------------------|------------------------------------|---------------|
| `name`, `instructions`, `input`, `output` | yes | — | — |
| `model` | default | per-call override | — |
| `maxTurns` | default | per-call override | — |
| `timeout`, `signal` | — | per-call only | — |
| `addons` | stable/registered addons | — | additional addons |

`agent.use(addon)` accepts **only** `AgentAddon | AgentAddon[]` — it does not accept spec fields or call-time overrides. Passing `maxTurns`, `model`, or any other spec field to `.use()` is a type error. Put stable defaults in the spec; pass per-run overrides at call time.

## Agent behavior defaults

| Setting | Default |
|---------|---------|
| Model | `gpt-4.1` |
| Max turns | `4` |
| Addons | none |

Override per call with `model`, `maxTurns`, `timeout`, and `signal`. Put stable defaults in the agent spec; use call-time options for per-run changes.

## Schemas

Use `s.*` helpers for input and output schemas.
These `s.*` declarations must stay JSON Schema-compatible and serialize directly as JSON Schema because rig renders prompt schema blocks as JSON Schema.

```ts
input: s.object({
  title: s.string,
  severity: s.enum("low", "medium", "high"),
})
```

Use explicit schemas in docs and generated samples.

## `s` schema helpers

```ts
s.string
s.string("description")
s.nonEmptyString                    // string with minLength: 1
s.nonEmptyString("description")
s.url                               // string with format: "uri"
s.url("description")
s.number
s.integer
s.int                               // alias for s.integer
s.boolean
s.unknown
s.array(item)
s.array(item, "description")
s.nonEmptyArray(item)               // array with minItems: 1
s.nonEmptyArray(item, "description")
s.object(fields)
s.object(fields, "description")
s.record(value)
s.record(value, "description")
s.nonEmptyObject(value)             // Record<string, V> with minProperties: 1
s.nonEmptyObject(value, "description")
s.enum(...values)
s.enum(values, "description")
s.optional(shape)
s.optional(shape, "description")
s.nullable(shape)
s.nullable(shape, "description")
s.literal(value)
s.literal(value, "description")
```

Common examples:

```ts
s.enum("bug", "feature", "question")
s.optional(s.number)
s.record(s.string)
s.record(s.array(s.string))         // Record<string, string[]>
s.record(s.object({ name: s.string, age: s.number }))
s.nullable(s.string)    // string | null
s.literal("done")       // exactly "done"
s.nonEmptyString        // non-empty string required
s.url                   // valid URL string
s.int                   // integer number (no floats); prefer over s.number for counts, line numbers, etc.
s.nonEmptyArray(s.string)  // string[] with at least one element
s.nonEmptyObject(s.string) // Record<string, string> with at least one key
```

## Tools

Register custom tools with `defineTool` using an SDK-neutral tool shape. Use `s.*` schemas for `parameters`. Rig defaults tools to `skipPermission: true`.
When `parameters` uses `s.*` schemas, `handler` args are inferred automatically; for plain JSON Schema, pass an explicit generic like `defineTool<{ issue: string }>(...)`.

```ts
import { agent, defineTool, s } from "rig";

const lookupIssue = defineTool("lookup_issue", {
  description: "Look up an issue by id.",
  parameters: s.object({
    issue: s.string,
  }),
  handler: async ({ issue }) => `Issue ${issue}`,
});

// Agent role: triage an issue using the lookup tool.
const triage = agent({
  model: "mini",
  instructions: "Use lookup_issue before answering.",
  tools: [lookupIssue],
});
```

## Prompt helpers

`p` is both the prompt template tag and the prompt-intent helper namespace.
These helpers are declarative placeholders, not direct shell execution in the core harness.
Prefer template expressions when the context source is already known.
Prefer `p.read("path")` over `p.bash("cat path")`, and keep large context in files instead of building in-memory strings just to feed an agent.
Rig assumes the surrounding workflow already provides the sandbox and protections it needs, so prompt intents for shell/file actions should execute directly without extra permission prompts.

```ts
p.bash("git diff -- .")
p.bash("npm test")
p.bashRaw`grep -rn 'app\.get\|app\.post' src/`  // tagged template: no TypeScript escape needed
p.read("README.md")
p.readOptional("Dockerfile")          // returns "" if file is absent
p.readOptional(".eslintrc.json", "{}") // returns "{}" if file is absent
p.write("README.md", "# Hello\n")    // write-file instruction; does NOT return the path
p.writeOutput("report", "todo-report.md")  // after generation, write output field "report" to file
p.glob("src/**/*.ts")
p.env("GITHUB_TOKEN")                 // returns "" if variable is not set
p.env("GITHUB_TOKEN", "unset")        // returns "unset" if variable is not set
p.json({ repo: "rig", stars: 42 })
```

Use `p.*` helpers:

- in input values
- inside `p\`\`` instruction templates, preferably as the default pattern

```ts
const prompt = p`Review the repository status using ${p.bash("git status --short")}.`;
```

Only introduce `input` fields for data the caller truly supplies at runtime. Do not require inputs just to thread known file or shell context into the prompt.

## `p` as a prompt builder for instructions

``p`...` `` can also be used in `instructions` when you want to embed prompt intents or inline context directly in the agent instructions.

```ts
import { agent, p, s } from "rig";

const reviewAgent = agent({
  instructions: p`Review the repository using ${p.bash("git status --short")} and summarize changes.`,
  output: s.object({ summary: s.string }),
});
```

- ``p`...` `` accepts `${p.bash(...)}`, `${p.bashRaw\`...\`}`, `${p.read(...)}`, `${p.readOptional(...)}`, `${p.write(...)}`, `${p.writeOutput(...)}`, `${p.glob(...)}`, `${p.env(...)}`, and `${p.json(...)}` expressions.
- Multiple `p.*` calls in the same template are resolved independently in order; each contributes its own instruction line.
- Nested `PromptBuilder` values used as interpolations are inlined as plain text.
- The rendered `PromptBuilder` replaces the instructions string when the agent prompt is assembled.
- `p.write(path, contents)` contributes a write-file instruction to the prompt; it does **not** return the file path or contents as text. If the output schema needs to reference the written path, hard-code the path string in the agent's output — it cannot be read from the `p.write(...)` expression. Use `p.read(path)` in a **separate** expression to read back written content.
- `p.writeOutput(field, path)` instructs the harness to write the value of output field `field` to the file at `path` after the agent generates its response. Use this instead of `p.write` when the content to be written is LLM-generated output — e.g. `p.writeOutput("report", "todo-report.md")` wires the `report` output field to `todo-report.md` automatically.
- `p.bash(cmd)` accepts a regular TypeScript string; backslashes and special characters must be escaped as in any TypeScript string literal. Use `p.bashRaw\`cmd\`` (tagged template) to avoid escaping — the command is taken verbatim from the template. When a grep or regex pattern contains `\.`, `\|`, or other backslash sequences, prefer `p.bashRaw`.
- `p.glob(pattern)` resolves to a list of matching paths at runtime; it is resolved by the Copilot runtime, not in-process. Brace expansion (`{ts,js}`) and negation patterns are resolved by the runtime and are not guaranteed to work identically across all environments; prefer simple glob wildcards when portability matters.
- `p.readOptional(path, fallback?)` reads a file if it exists; returns the fallback string (default `""`) if the file is absent. Use this instead of `p.read` when the file may not exist.
- `p.env(name, fallback?)` reads an environment variable; returns the fallback string (default `""`) if the variable is not set.
- `p.json(value)` returns a pretty-printed JSON string immediately; use it to inline structured data into a prompt template without calling `JSON.stringify` manually.

## Call-time options

Pass overrides when calling an agent:

```ts
const controller = new AbortController();

const result = await myAgent(input, {
  model: "mini",
  timeout: 30_000,
  maxTurns: 2,
  signal: controller.signal,
});
```

Use call-time options for per-run changes. Use addons for stable defaults (for example `timeout({ timeout: ... })`).

## Subagents

Expose subagents with `agents`:

```ts
// Agent role: extract the most important changes from the diff.
const summarizeDiff = agent({
  model: "mini",
});

// Agent role: review the diff using the provided subagent when helpful.
const reviewer = agent({
  model: "mini",
  output: s.object({
    summary: s.string,
    issues: s.array(s.string),
  }),
  agents: { summarizeDiff },
  instructions: "Review the diff. You may use the provided subagent conceptually.",
});
```

When delegating task resolution, keep each subagent narrow and explicit (for example: `analyzeTask`, `draftRigProgram`, `verifySchema`) and make the root agent instructions require combining their outputs into one final response.

## Sequential two-agent chaining

There is no built-in chain primitive. The recommended idiom for sequential agent composition is to wire the upstream agent as a named subagent of the downstream agent via `agents: { ... }`. This keeps all agents reachable from the exported root and avoids TS6133 unused-variable errors.

```ts
// Agent role: extract key facts from the input text.
const extractor = agent({
  model: "mini",
  output: s.object({ facts: s.array(s.string) }),
});

// Agent role: assess extracted facts and return a verdict.
const assessor = agent({
  model: "mini",
  output: s.enum("healthy", "needs-work", "critical"),
  agents: { extractor },
  instructions: "Use the extractor subagent to gather facts, then produce a verdict.",
});

export default assessor;
```

Declaring `const extractor = agent(...)` without adding it to `agents: { extractor }` on the root agent causes TypeScript error TS6133 ("declared but its value is never read") because the variable is unused. Always attach upstream agents to `agents` on the root export.

## Task harness pattern for rig markdown

When the task asks for a runnable markdown example, require exactly one fenced ````rig` block that is valid inline harness input:

- include `import { ... } from "rig"` (or rely on inline injection intentionally)
- define one default-exported no-input root agent
- avoid calling the root agent directly in the snippet
- keep the block aligned with this skill's construction order and checklist

## Repair and retries

Rig starts with no addons by default. Opt into retry behavior with `repair` from `rig/addons`.

```ts
import { repair } from "rig/addons";

// Agent role: repair invalid output and return a stable summary.
const summarize = agent({
  model: "mini",
  maxTurns: 3,
  addons: repair,
});
```

`maxTurns` sets the total turn budget (initial attempt + retries). Automatic repair on JSON or schema failure requires the `repair` addon; setting `maxTurns` alone does not enable repair. Both must be present to get automatic retry behavior.

Use `steering()` from `rig/addons` to append a last-chance warning on the final retry turn. Add `steering()` **after** `repair` in the `addons` array so it can append to the repair prompt:

```ts
import { repair, steering } from "rig/addons";

const summarize = agent({
  model: "mini",
  maxTurns: 3,
  addons: [repair, steering()],
});
```

Use `repair` alone when the LLM just needs to be told what was wrong. Add `steering()` when you also want to warn it that the next turn is the last chance. Do not add `steering()` without `repair` — it only appends to prompts generated by `repair`.

Use `oncePerAgent()` from `rig/addons` to run a registration callback exactly once per agent instance (not per turn). The callback receives the runtime `Agent` object and the addon context. This is useful for registering shared resources that should be set up once per invocation:

```ts
import { oncePerAgent } from "rig/addons";
import type { Agent } from "rig";

let sharedCache: Map<string, string> | undefined;

// Agent role: answer questions using a shared per-invocation cache.
const qa = agent({
  model: "mini",
  addons: oncePerAgent((runtimeAgent: Agent) => {
    sharedCache = new Map();
  }),
});
```

The callback is called once per agent instance. When `repair` retries across multiple turns, `oncePerAgent` still fires only once for that invocation.

The addon `context` object contains: `prompt`, `response`, `turn`, `maxTurns`, `signal`, `output`, `nextPrompt`, `error`, `completed`, and `agent`.

## Running programs

Treat fenced `rig` code blocks in markdown as runnable rig programs.
Run them by extracting the fence content and piping it into `node skills/rig/rig.ts`.
Inline programs run a default-exported root program with no required external input and write stdout. Export either an agent, a string, or a prompt builder value. If `export default` is omitted, the harness defaults to the first `const/let/var name = agent(...)` assignment:

```bash
cat <<'RIG' | node skills/rig/rig.ts
// Agent role: summarize this repository in one sentence.
export default "Summarize this repository in one sentence.";
RIG
```

`import { agent, p, s } from "rig"` is optional in inline mode; the harness injects it if omitted.

Inline mode accepts root agents that either omit `input`, use `input: s.object({})`, or rely on the default `input: s.string` (which is invoked with `""`).

The harness also supports program-file mode. Export the root program as the default export and pass input on stdin:

```bash
echo "Review this diff" | node skills/rig/rig.ts src/program.ts
```

Pass `--server` to have the harness start the Copilot server automatically before running:

```bash
echo "Review this diff" | node skills/rig/rig.ts src/program.ts --server
```

Pass `--typecheck` to typecheck the rig program and exit without executing it.
On success, writes `typecheck passed` to stdout and exits 0. On failure, throws with the TypeScript diagnostic output.

```bash
cat <<'RIG' | node skills/rig/rig.ts --typecheck
import { p } from "rig";
export default p`Summarize this repository and include highlights from ${p.read("README.md")}.`;
RIG
```

Program-file mode also supports `--typecheck`:

```bash
echo "Review this diff" | node skills/rig/rig.ts src/program.ts --typecheck
```

When a program file is located outside the project root (for example `/tmp/my-agent.ts`), the harness automatically uses a `.mts` shadow file so TypeScript treats it as ESM. If the program imports sibling modules with relative paths (`./utils`), ensure the file's directory (or an ancestor) contains `{"type":"module"}` in `package.json`.

For program-file mode stdin coercion:
- if root input schema is `string`, stdin is passed as raw text
- if root input schema is an object containing `text`, stdin is passed as `{ text: "<stdin>" }`
- otherwise stdin must be valid JSON for the declared input schema

## Agent implementations

An SDK adapter implements the minimal `Agent` interface with `ask()` and `close()` methods. Register its factory with `configureAgent()`. Rig creates one adapter instance per invocation and does not branch on the underlying SDK.

Rig provides `copilotEngine()`, `codexEngine()`, `piEngine({ provider })`, and `anthropicEngine()` factories. The Codex factory uses `@openai/codex-sdk`; the pi-agent factory uses `@earendil-works/pi-agent-core`; the Anthropic factory reads `ANTHROPIC_API_KEY` through `@anthropic-ai/sdk`.

```ts
import { anthropicEngine } from "rig/engines/anthropic";
import { codexEngine } from "rig/engines/codex";
import { piEngine } from "rig/engines/pi";

configureAgent(piEngine({ provider: "anthropic" }));
// or
configureAgent(anthropicEngine());
// or
configureAgent(codexEngine());
```

`codexEngine()` accepts Codex client options and a `thread` object for Codex thread options. It preserves the Codex thread across repair turns and maps Rig system messages to Codex developer instructions. The Codex SDK does not expose custom tool registration, so agents configured with Rig tools are rejected.

By default `copilotEngine()` connects over HTTP using `COPILOT_SDK_URI`, then `localhost:7777`.
Use `--server` at launch time when you want the harness to start the Copilot server via stdio.

## Patterns to prefer

- Prefer `s.object(...)` for important examples. Omit schemas entirely when the default free-form string is enough.
- Keep outputs small, typed, and explicit.
- Use `s.enum(...)` when exact values matter.
- Prefer `p.*` inside `p\`\`` templates; fall back to inputs only for real caller-provided data.
- Prefer `p.read(...)` for existing files instead of shelling out through `cat`.
- Assume Node.js 24 runtime for operational code.
- Prefer `google/zx` for shell-style automation in TypeScript examples.
- Prefer Node.js native APIs (including built-in `fetch` and native glob support) before adding dependencies.
- Put durable defaults in the agent spec; register addons in spec or with `agent.use(...)`.
- Use `steering()` from `rig/addons` when you want the builtin last-retry warning addon; it is opt-in.
- Introduce `agents` only when the scenario needs them.

## Patterns to avoid

- When a free-form string is enough, omit `input`/`output` and use the default `s.string` schemas.
- Do not wrap a single string field in an input object just to carry text.
- Do not import prompt helpers from anywhere except `rig`.
- Do not require `input` fields just to pass `p.read(...)` / `p.bash(...)` context into instructions.
- Do not leave outputs as unstructured prose when a schema would help.
- Do not invent alternate schema syntaxes when explicit `s.*` is available.
- Do not replace file reads with `cat`-style shell commands or large in-memory strings when a file path already exists.
- Do not add third-party fetch or glob helpers when Node.js 24 native APIs already cover the requirement.
- Do not put call-time overrides (`model`, `timeout`, `maxTurns`, `signal`) into unrelated config objects.

## API direction

Use only the current API:

- `agent({ name, ... })`
- `p.*` and `p\`...\`` from `rig`
- `s.*` for explicit schema helpers
- `oncePerAgent` / `repair` / `steering` / `timeout` from `rig/addons` for optional addons

Do not add deprecated hooks or compatibility layers.
