# Agent API and schemas

Read this reference when a program needs less-common spec fields, precise schema overloads, custom tools, or invocation overrides.

## `agent(spec)`

Use `agent({ name, ... })` as the only declaration form. `name` is optional and normalizes to `"agent"`.

| Field | Purpose |
|-------|---------|
| `name` | Name included in the agent prompt |
| `instructions` | Plain string or ``p`...` `` prompt builder |
| `input` | Input schema; defaults to `s.string` |
| `output` | Output schema; defaults to `s.string` |
| `model` | Default model for calls |
| `maxTurns` | Total turn budget, including the initial attempt |
| `addons` | Per-turn steering, validation, and retry behavior |
| `agents` | Named subagents exposed to the harness |
| `tools` | Function-calling tools created with `defineTool` or compatible plain objects |

### Setting placement

| Setting | Spec | Call-time | `.use(addon)` |
|---------|------|-----------|---------------|
| `name`, `instructions`, `input`, `output`, `agents`, `tools` | yes | — | — |
| `model`, `maxTurns` | default | override | — |
| `timeout`, `signal` | — | yes | — |
| `addons` | stable addons | — | additional addons |

`agent.use()` accepts only `AgentAddon | AgentAddon[]`; passing spec fields or invocation options is a type error.

### Defaults

| Setting | Default |
|---------|---------|
| Name | `"agent"` |
| Input/output | `s.string` |
| Model | `small` |
| Max turns | `4` |
| Addons | none |

## Schema helpers

Use declarative `s.*` values for every schema node. They remain JSON Schema-compatible and are rendered directly into prompt schema blocks.

```ts
s.string
s.string("description")
s.nonEmptyString
s.nonEmptyString("description")
s.url
s.url("description")
s.path
s.path("description")
s.number
s.integer
s.int
s.boolean
s.unknown
s.array(item)
s.array(item, "description")
s.nonEmptyArray(item)
s.nonEmptyArray(item, "description")
s.object(fields)
s.object(fields, "description")
s.record(value)
s.record(value, "description")
s.nonEmptyObject(value)
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

Helper constraints:

- `s.nonEmptyString` sets `minLength: 1`.
- `s.url` uses format `"uri"`; `s.path` uses format `"path"`.
- `s.int` aliases `s.integer`.
- Prefer `s.int` for counts/line numbers and `s.number` for measurements, scores, and ratios.
- `s.nonEmptyArray(item)` sets `minItems: 1`.
- `s.nonEmptyObject(value)` describes `Record<string, V>` with `minProperties: 1`.
- `s.optional(shape)` allows omission; `s.nullable(shape)` allows `null`.

Use `s.optional` when absence is valid and `s.nullable` when the field should still be present but may be `null`:

```ts
const output = s.object({
  lastFile: s.optional(s.path),
  archivedAt: s.nullable(s.string),
});
```

Use `s.record(value)` for string-keyed maps when keys are not fixed ahead of time. Record keys are always `string`; there is no key-type constraint:

```ts
s.record(s.number)  // e.g. churn score keyed by filename
s.record(s.int)     // e.g. occurrence counts keyed by identifier — use instead of s.array(s.object({key, count}))
```

`s.url` uses format `"uri"` and is a valid schema helper for URL-valued fields (same usage as `s.path` for file-system locations).

Description placement:

| Helper family | Description argument |
|---------------|----------------------|
| Scalars (`s.string`, `s.int`, `s.path`, `s.url`, `s.boolean`, `s.unknown`) | First |
| Containers (`s.array`, `s.object`, `s.record`, `s.optional`, `s.nullable`, `s.nonEmptyArray`, `s.nonEmptyObject`) | Second, after the shape/value |
| `s.enum`, `s.literal` | Last |

Common contracts:

```ts
s.enum("bug", "feature", "question")
s.optional(s.int)
s.record(s.string)
s.record(s.int)                                             // aggregate counts keyed by string
s.record(s.array(s.string))
s.record(s.object({ name: s.string, age: s.number }))
s.record(s.object({ path: s.path, homepage: s.url }))
s.nullable(s.string)
s.literal("done")
s.nonEmptyArray(s.path)
s.nonEmptyObject(s.boolean)
```

Prefer `s.path` for file-system locations, `s.url` for URIs, and `s.int` for counts or line numbers. Omit schemas entirely when free-form strings are sufficient.

## Tools

Register SDK-neutral tools with `defineTool`. Rig converts `s.*` parameters to JSON Schema and infers the handler argument type.

```ts
import { agent, defineTool, s } from "rig";

const lookupIssue = defineTool("lookup_issue", {
  description: "Look up an issue by id.",
  parameters: s.object({
    issue: s.string,
  }),
  handler: async ({ issue }) => ({ issue, status: "open" }),
});

// Agent role: triage an issue using the lookup tool.
const triage = agent({
  model: "mini",
  instructions: "Use lookup_issue before answering.",
  tools: [lookupIssue],
});

export default triage;
```

For plain JSON Schema parameters, provide a generic such as `defineTool<{ issue: string }>(...)`. A handler may return a string or any JSON-serializable value; Rig serializes non-string values, so do not call `JSON.stringify` in the handler. Tools default to `skipPermission: true`.

`s.unknown` is valid in tool parameter schemas for caller-provided values whose concrete type is intentionally open:

```ts
const scoreField = defineTool("score_field", {
  description: "Score one package.json field.",
  parameters: s.object({
    field: s.string,
    value: s.unknown,
  }),
  handler: async ({ field, value }) => ({ field, present: value !== undefined }),
});
```

Async handlers can import Node built-ins directly:

```ts
import { defineTool, s } from "rig";

// Using node:child_process
const countLines = defineTool("count_lines", {
  description: "Count file lines with wc.",
  parameters: s.object({ path: s.path }),
  handler: async ({ path }) => {
    const { execSync } = await import("node:child_process");
    const output = execSync(`wc -l ${JSON.stringify(path)}`, { encoding: "utf8" });
    return { lineCount: Number(output.trim().split(/\s+/)[0] ?? "0") };
  },
});

// Using node:fs/promises
const readFileSize = defineTool("read_file_size", {
  description: "Return the byte size of a file.",
  parameters: s.object({ path: s.path }),
  handler: async ({ path }) => {
    const { stat } = await import("node:fs/promises");
    const info = await stat(path);
    return { bytes: info.size };
  },
});
```

For recursive directory walks with `node:fs/promises` `readdir`, set `encoding: "utf-8"` when you need string paths:

```ts
const { readdir } = await import("node:fs/promises");
const paths = await readdir("src", { recursive: true, encoding: "utf-8" });
```

Without `encoding`, the recursive overload can resolve to `Dirent[]`, which will not type-check as `string[]`.

Strict TypeScript compilation reports unused handler bindings. Destructure only the keys the handler uses, or rename an unavoidable binding with a leading underscore, such as `{ filename: _filename, content }`.

When returning discriminated unions from a handler, keep discriminator literals narrow with `as const` (or an explicit return type) so TypeScript does not widen `"missing"` to `string`.

Arrow function callbacks inside handler bodies must have explicit type annotations on their parameters under `noImplicitAny`. TypeScript can infer the element type when the array is typed, but the inference chain breaks when a handler arg is `any` — for example, when `parameters` is a plain object (`{ content: s.string }`) rather than `s.object({ content: s.string })`. Add annotations to be safe:

```ts
// May fail under noImplicitAny if content is any
content.split("\n").map(line => line.trim())

// Always safe — explicit type prevents the cascade
content.split("\n").map((line: string) => line.trim())
```

Use `: string` for string array callbacks, `: RegExpMatchArray` for `matchAll` results.

Use `defineTool` for I/O operations and external calls the LLM should be able to invoke — fetching a URL, running a query, reading a dynamic path. Do not use it to replace LLM inference: if the handler implements the classification or reasoning logic entirely in TypeScript, the model is never exercised for that step. Express classification rules as prompt instructions instead, and use a tool only when a discrete external operation is needed to support the model's reasoning.

### `defineTool` vs `p.bash` decision table

| Situation | Use |
|-----------|-----|
| Static shell command known at definition time | `p.bash(command)` |
| Command contains literal backslashes or regex | ``p.bashRaw`command` `` |
| External I/O the model should invoke conditionally (fetch URL, read dynamic path, query DB) | `defineTool` |
| Deterministic transform that gives the model intermediate data to reason about | `defineTool` |
| Full classification or judgment logic implemented in TypeScript | Neither — use prompt instructions |
| Command depends on a caller-supplied value | Prose description in instructions; reference field with `p.inputField(field)` |

## Call-time options

Use call-time options only for per-run changes:

```ts
const controller = new AbortController();

const result = await myAgent(input, {
  model: "mini",
  timeout: 30_000,
  maxTurns: 2,
  signal: controller.signal,
});
```

Put durable `model` and `maxTurns` defaults in the spec. Put `timeout` and `signal` only on the invocation.

## API boundary

Use only the current API:

- `agent({ name, ... })`
- `p.*` and ``p`...` `` from `rig`
- `s.*` for explicit schemas
- `oncePerAgent`, `repair()`, `steering`, and `timeout` from `rig`

Do not add deprecated hooks, alternate schema syntaxes, or compatibility bridges.
