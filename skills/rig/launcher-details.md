# Launcher details

Read after [Running programs](./runtime.md) for inline input defaults, heredoc
alternatives, ESM behavior, and operational conventions.

## Inline root resolution

The launcher accepts an agent, workflow, string, or prompt builder as the
default export. When omitted, it injects `import { agent, p, s } from "rig"`.
Without a default export, it falls back to the first `const`/`let`/`var`
assigned from `agent(...)`; prefer an explicit default export.

Inline mode accepts these root inputs:

| Input | Omitted value |
|---|---|
| No `input` or default `s.string` | `""` |
| `s.object({})` | `{}` |
| `s.object({ text: s.string })` | `{ text: "" }` |

For other input shapes, use program-file mode with schema-conforming stdin.

## Heredocs outside the Copilot SDK workflow driver

Use a literal printf pipeline with the SDK driver. Elsewhere, a heredoc is
an alternative:

```bash
node skills/rig/run.ts <<'<delimiter>'
// Agent role: summarize this repository in one sentence.
export default "Summarize this repository in one sentence.";
<delimiter>
```

Before composing each command, choose a fresh 7-character pseudo-random
alphanumeric delimiter yourself. Do not run a tool, Python, Node,
`/dev/urandom`, `base64`, `tr`, or a pipeline to generate it.
Ensure it is not an entire line of the source, including a possible trailing
`\r`; regenerate on collision. Single-quote the opener to suppress expansion.
Put the same literal delimiter, unquoted and unindented, alone on the closing
line. Do not reuse a fixed delimiter or a shell variable: Bash does not expand
delimiter words.

## Execution and typechecking

Both launch modes evaluate the program inside a workflow run. A workflow root
nests instead of starting a second run; events use the `workflow:event` debug
category. Stdout is reserved for the root result, while runtime
lifecycle/request events may be emitted as JSONL on stderr.

Typechecking invokes the preinstalled compiler using Node directly, never
npm/npx or a dependency download. For a standalone `.ts` program outside an
ESM package, the launcher uses a temporary `.mts` shadow. Relative sibling
imports still require the program directory or an ancestor to contain
`{"type":"module"}` in `package.json`.

Use `--help`, `-h`, `help`, `/help`, or `/?` to print launcher usage.

## Harness-owned connection pipe

`--connection-fd=<fd>` reads one JSON object from an inherited descriptor
of 3 or greater: `{ "uri": "...", "connectionToken": "..." }`.
The harness writes this payload and closes its pipe; source remains on stdin.
Rig reads at most 16 KiB, closes the descriptor, validates the payload, and
uses the connection for that launch without changing `process.env`.
It also applies when the program calls `configureAgent(copilotEngine())`;
an explicit `copilotEngine({ connection })` still takes precedence.
This flag forces the default engine to Copilot and cannot be combined with
`--server` or `--typecheck`. Do not put credentials in CLI arguments or source.

Use [Harness tools](./harness-tools.md) to register `run_rig` in a trusted SDK
driver. The pipe is an authorized handoff, not a way to recover credentials
that a shell runtime intentionally filters.

## Operational conventions

- Assume Node.js 24.
- Prefer Node native APIs, including built-in `fetch` and glob support, before adding dependencies.
- Prefer `google/zx` (`import { $ } from "zx"`) for shell-style TypeScript automation.
