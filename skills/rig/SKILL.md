---
name: rig
description: Create, review, and run typed TypeScript agents and workflows with Rig. Use when writing Rig programs, generating runnable rig markdown fences, defining agent schemas and prompt intents, or configuring Rig engines and addons.
license: MIT
compatibility: Requires Node.js 24 or later and preinstalled skill dependencies. Typechecking also requires a preinstalled TypeScript compiler. Live agent calls require a configured Copilot SDK endpoint or another supported engine.
---

# rig

Minimal TypeScript harness for typed agents in sandboxed workflows and runnable `rig` markdown fences.

Use this file for construction defaults. Load only the focused reference named by the task; do not read every reference preemptively.

## Canonical program

```ts
import { agent, p, s } from "rig";

// Agent role: review the current diff and return prioritized findings.
const reviewDiff = agent({
  model: "small",
  instructions: p`Review ${p.bash("git diff -- .")} and return only the declared output.`,
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
    findings: s.array(s.object({
      file: s.path,
      line: s.optional(s.int),
      message: s.string,
    })),
  }),
});

export default reviewDiff;
```

## Construction rules

1. Import current APIs from `"rig"` once and define agents with `agent({ ... })` or workflows with `workflow({ ... })`.
2. Add a `// Agent role: ...` comment above each `agent()` and a `// Workflow role: ...` comment above each `workflow()`.
3. Omit `input`/`output` when free-form strings suffice; otherwise use explicit `s.*` schemas.
4. Put known workspace context in ``p`...` `` with `p.read`, `p.bash`, or another intent. Use `input` only for caller-supplied values.
5. Keep outputs strict and small; prefer `s.enum`, `s.literal`, `s.path`, and `s.int` when they express the contract.
6. Add narrow, named subagents only when delegation helps; attach them as `agents: { name }`.
7. Export exactly one root value — an `agent` or a `workflow`. Do not invoke it or print its result in generated programs.

Defaults: `name: "agent"`, `model: "small"`, `maxTurns: 4`, string input/output, and no addons.

For GitHub Agentic Workflows, tell the user to import the
[shared Rig template](../../.github/workflows/shared/rig.md) or explicitly allow
`node` in `tools.bash` and provision Node.js 24+ with the skill's dependencies.
See [Agentic Workflows](./agentic-workflows.md) for
the import syntax and Copilot SDK configuration.

## High-frequency decisions

| Need | Choose |
|------|--------|
| Known required/optional file | `p.read(path)` / `p.readOptional(path, fallback?)` (prefer this over `cat ... || echo ...`) |
| Several known files | `p.readAll(["path/a.ts", "path/b.ts"])` (explicit array of literal paths) |
| Static shell command | `p.bash(command)`; use ``p.bashRaw`...` `` for literal backslashes |
| Caller-supplied path(s) | `p.readInput(field)` / `p.readAllInput(field)` with `s.path` schemas |
| Discover workspace paths | `p.glob(pattern)` returns paths only; then delegate one path at a time to a subagent using `p.readInput("path")` (there is no `p.readAll(globPattern)` overload) |
| Persist generated output | `p.writeOutput(field, path)` or `p.writeInput(pathField, outputField)` |
| String-keyed map | `s.record(value)`; keys are always `string` — do not wrap in `s.object`; use `s.record(s.int)` for count maps |
| URL and file-path fields | `s.url` for URIs, `s.path` for paths, and wrappers like `s.array(s.path)` for path lists |
| Numeric schema choice | `s.int` for counts/line numbers; `s.number` for measurements and ratios |
| Optional versus nullable | `s.optional(shape)` for omission; `s.nullable(shape)` for explicit `null` |
| Deterministic TypeScript fan-out | `workflow({ meta, input?, body })` + `export default`; use `call`, `pipeline`, `parallel`, `until` inside `body` |
| One-off prompt inside a workflow | `call.text(prompt)` for a string, `call.json(prompt, schema)` for structured output |
| Reusable workflow step | Define an `agent({ input, output })` and `call(worker, input, { label, phase })` |
| Phase or log from an agent program | Import `phase` / `log` from `rig` and call them at top level; the launcher runs every program inside a workflow |
| Ambient `call` outside `body` | Import `call` from `"rig/globals"`; it routes through the active workflow context automatically. Do not import from `"rig/globals"` unless you need it — this avoids polluting non-workflow code. |
| Custom model-callable operation | `defineTool(name, { description, parameters, handler })` |
| Structured-output retries | `maxTurns` on the agent plus `addons: [repair()]` |
| Retry with final-turn warning | `addons: [steering(), repair()]` in that order |

Prompt intents are declarative instructions, not in-process operations. Prefer file intents over `cat` and workspace paths over large in-memory strings.

## Composition invariants

- `agents` is a named object, never an array; every subagent must be reachable from the exported root.
- There is no chain or loop primitive. Tell the coordinator what to delegate, in what order, and what combined output to return.
- `defineTool` uses the two-argument config form. Use `s.object({ ... })` for object-shaped parameters — plain `{ key: s.string }` loses handler arg type inference. Arrow callbacks in handlers must have explicit type annotations: `.map((line: string) => ...)`.
- `repair()` takes no arguments. Turn budgets belong on the agent spec or invocation. Repair turns are parse/schema retry turns; a steering turn is only the last warning prepended to the final repair retry.
- Stable settings belong in `agent({ ... })`; per-run `model`, `maxTurns`, `timeout`, and `signal` belong on invocation; `agent.use()` accepts only addons.
- Valid `agent()` fields: `name`, `instructions`, `input`, `output`, `model`, `maxTurns`, `addons`, `agents`, `systemMessage`, `tools`. Misspelled keys (e.g. `instructions2`) are silently dropped; the linter flags them.
- Handler functions that return string literals must use `as const` to preserve the literal type for enum schema comparison. Example: `return "stable" as const`.

## Runnable output

For runnable markdown, emit exactly one fenced `rig` block with one default-exported root (`agent` or `workflow`) and no required external input. Never call the root inside the fence. Add a `// Agent role: ...` comment above each `agent()` and a `// Workflow role: ...` comment above each `workflow()`.

Before running generated TypeScript:

```bash
node skills/rig/eslint/lint.js program.ts
node skills/rig/run.ts --typecheck < program.ts
```

For an installed skill, replace `skills/rig` with its installed directory. Use
`run.ts` to launch without installing packages. For Copilot SDK workflows, pipe
literal source with `printf '%s\n' '<source line>' ... | node <skill-dir>/run.ts`.
Use one single-quoted argument per source line, escaping each literal apostrophe
as `'"'"'`. Keep `%s\n` as the fixed format; never use source as a format string,
double-quote source, or expand shell variables. Do not use heredocs with the
SDK driver; see [Running programs](./runtime.md) for launch essentials and
[Launcher details](./launcher-details.md) for quoting alternatives.
Install the skill with `gh skill install githubnext/rig rig`.
Assume SDKs are already installed in the agent container; do not install them.
Import the shared Rig workflow template or explicitly allow `printf` and `node`
with `bash: ["printf", "node"]`. Grant other commands only when the program needs
them. The launch pipeline must begin with `printf`: no `mkdir`, `cd`, `env`,
package manager, or other preparation, and no `&&` prefix. Use existing output
directories. When launching against an existing Copilot SDK endpoint, pass both
`COPILOT_SDK_URI` and `COPILOT_CONNECTION_TOKEN` through to the Node process
unchanged; do not drop the token when configuring a subprocess environment.
`copilotEngine()` forwards that token to the SDK connection automatically.
Never print or embed the token in source or shell commands. See
[Agentic Workflows](./agentic-workflows.md) for detailed credential handoff requirements.
Report denied commands accurately.

## Final check

- Known context uses `p.*`; caller data uses `input`.
- Schemas use only current `s.*` helpers and constrain important output.
- Every import, addon, tool, and helper follows the current API.
- Every subagent is named, reachable, and narrowly scoped.
- The program has one default export (an `agent` or a `workflow`) and no `console.log`.
- Linting and typechecking pass.

## Focused references

Read only when the task needs the listed detail:

- [Agent API and schemas](./agent-api.md) — spec fields, schema overloads, tools, and invocation options.
- [Prompt intents](./prompt-intents.md) — complete helper semantics, dynamic inputs, writes, and failure behavior.
- [Composition and addons](./composition.md) — delegation patterns, dynamic sets, repair, steering, and addon lifecycle.
- [Dynamic workflows](./dynamic-workflows.md) — bounded fan-out, failure semantics, limits, budget, events, and convergence loops.
- [Claude workflow conversion](./claude-workflow-conversion.md) — mapping Claude Code dynamic-workflow scripts onto rig primitives, including model selection and the Anthropic engine.
- [Running programs](./runtime.md) — launch essentials, stdin, typechecking, and SDK credential forwarding.
- [Launcher details](./launcher-details.md) — inline input defaults, heredocs outside the SDK driver, and ESM edge cases.
- [Harness tools](./harness-tools.md) — registering `run_rig` in a trusted SDK driver with pipe-based credential handoff.
- [Agentic Workflows](./agentic-workflows.md) — workflow imports, permissions, prerequisites, SDK handoff, and integration testing.
- [Engines](./engines.md) — adapter selection, provider configuration, tools, output enforcement, and lifecycle.
- [Debug logging](./debugging.md) — `RIG_DEBUG` categories for launch, agent, workflow, and engine diagnosis.
- [Linting](./linting.md) — linter usage, autofixes, rules, and rule development.
