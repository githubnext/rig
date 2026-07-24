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
- `s.nonEmptyArray(item)` sets `minItems: 1`.
- `s.nonEmptyObject(value)` describes `Record<string, V>` with `minProperties: 1`.
- `s.optional(shape)` allows omission; `s.nullable(shape)` allows `null`.

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
s.record(s.array(s.string))
s.record(s.object({ name: s.string, age: s.number }))
s.nullable(s.string)
s.literal("done")
s.nonEmptyArray(s.path)
s.nonEmptyObject(s.boolean)
```

Prefer `s.path` for file-system locations and `s.int` for counts or line numbers. Omit schemas entirely when free-form strings are sufficient.

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

Strict TypeScript compilation reports unused handler bindings. Destructure only the keys the handler uses, or rename an unavoidable binding with a leading underscore, such as `{ filename: _filename, content }`.

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
- `oncePerAgent`, `repair({ maxTurns })`, `steering`, and `timeout` from `rig/addons`

Do not add deprecated hooks, alternate schema syntaxes, or compatibility bridges.
