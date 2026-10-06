# Running programs and engines

Read this reference when launching or typechecking programs, handling stdin, or selecting an SDK adapter.

## Inline programs

Treat a fenced `rig` block as a runnable program. Extract its contents and pipe them to the launcher:

```bash
cat <<'RIG' | node skills/rig/rig.ts
// Agent role: summarize this repository in one sentence.
export default "Summarize this repository in one sentence.";
RIG
```

Inline mode:

- writes the root result to stdout
- accepts an agent, workflow, string, or prompt builder as the default export
- injects `import { agent, p, s } from "rig"` when omitted
- accepts a root with no `input`, `input: s.object({})`, `input: s.object({ text: s.string })`, or the default `s.string` input; omitted values become `{}`, `{ text: "" }`, or `""`
- falls back to the first `const`/`let`/`var` assigned from `agent(...)` if `export default` is omitted

Prefer an explicit default export even though the fallback exists.

## Program files

Export the root and pass stdin plus the file path:

```bash
echo "Review this diff" | node skills/rig/rig.ts src/program.ts
```

Stdin coercion follows the root schema:

- `s.string`: raw stdin text
- object containing `text`: `{ text: "<stdin>" }`
- any other schema: stdin must be valid JSON

The launcher writes string results, or the string `text` field of an object result, directly to stdout. It JSON-serializes other results.

Both modes evaluate the program and run its root inside a workflow run, so
top-level `phase()` and `log()` work in any program and `currentWorkflow()` is
defined from module scope. A `workflow` default export nests into that run
instead of starting a second one. Run events are emitted under the
`workflow:event` debug category.

Add `--server` in either mode to start the Copilot server over stdio and force the Copilot engine. Without it, `copilotEngine()` connects over HTTP using `COPILOT_SDK_URI`, then `localhost:7777`.

Use `--help`, `-h`, `help`, `/help`, or `/?` to print launcher usage.

## Typechecking

`--typecheck` validates and exits without creating runtime sessions or invoking the root:

```bash
cat program.ts | node skills/rig/rig.ts --typecheck
echo "Review this diff" | node skills/rig/rig.ts src/program.ts --typecheck
```

Success prints `typecheck passed` and exits 0. Failure reports TypeScript diagnostics.

For a standalone `.ts` program outside an ESM package, the launcher uses a temporary `.mts` shadow. Relative sibling imports still require the program directory or an ancestor to contain `{"type":"module"}` in `package.json`.

## GitHub Agentic Workflows

Enable Copilot SDK driver mode and pin the Rig skill to an immutable commit:

```yaml
engine:
  id: copilot
  copilot-sdk: true
skills:
  - githubnext/rig/skills/rig/SKILL.md@<full-commit-sha>
```

Import `configureAgent` and `copilotEngine` in the fenced program and call `configureAgent(copilotEngine())` before defining agents. Grant `copilot-requests: write`, and enable only the tools and network access the program uses.

Edit workflows with an agent or run `gh aw compile --watch` for immediate feedback. Before committing, run `gh aw compile <workflow-id> --strict` and include the generated `.lock.yml`.

## Agent interface

Adapters implement the SDK-neutral interface:

```ts
interface Agent {
  ask(prompt: string, options?: {
    signal?: AbortSignal;
    outputSchema?: Record<string, unknown>;
  }): Promise<string>;
  close(): Promise<void>;
}
```

An `AgentFactory` receives the resolved `model`, `systemMessage`, and tools. Register a factory with `configureAgent(factory)`. Rig creates one adapter instance per invocation and preserves it across repair turns.

## Included engines

```ts
import { configureAgent, copilotEngine } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";
import { codexEngine } from "rig/engines/codex";
import { geminiEngine } from "rig/engines/gemini";
import { piEngine } from "rig/engines/pi";

configureAgent(copilotEngine());
// or
configureAgent(piEngine({ provider: "anthropic" }));
// or
configureAgent(anthropicEngine());
// or
configureAgent(codexEngine());
// or
configureAgent(geminiEngine());
```

- If you do not call `configureAgent(...)`, Rig auto-selects an engine from env vars:
  - `COPILOT_SDK_URI` → `copilotEngine()`
  - `RIG_ENGINE` (`copilot` | `anthropic` | `codex` | `gemini`) to force a specific default when Copilot URI is not set.
  - `ANTHROPIC_API_KEY` → `anthropicEngine()`
  - `OPENAI_API_KEY` → `codexEngine()`
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY` → `geminiEngine()`
  - otherwise → `copilotEngine()`
- `copilotEngine(options)` accepts Copilot client options plus `server` and `connection`. It supports Rig tools and uses the Copilot SDK HTTP transport by default; launcher `--server` selects stdio. Rig forwards output schemas through the SDK's `responseSchema` option. String system messages are appended to the SDK instructions; SDK `append`, `replace`, and `customize` configurations are also accepted.
- `piEngine({ provider, models? })` uses `@earendil-works/pi-agent-core`, requires a provider for model lookup, and supports Rig tools.
- `anthropicEngine(options)` uses `@anthropic-ai/sdk`, reads `ANTHROPIC_API_KEY`, supports Rig tools, and accepts `maxTokens` and `maxIterations`. It accepts string system messages or Anthropic text-block arrays. For compatible object outputs it uses `output_config.format` through the SDK's JSON Schema helper; other shapes remain prompt-driven.
- `codexEngine(options)` uses `@openai/codex-sdk`, accepts thread options under `thread`, preserves the thread across repair turns, maps Rig system messages to developer instructions, and forwards structured output schemas. It rejects Rig tools because the SDK does not expose custom tool registration.
- `geminiEngine(options)` runs an installed Gemini CLI in headless JSON mode and resumes its session across repair turns. It accepts `command`, `cwd`, CLI `args`, environment variables, and `approvalMode`; it rejects Rig tools because the CLI does not expose registration.

The standalone skill pins Copilot SDK 1.0.16. Repository dependencies also cover
Anthropic SDK 0.129.0, Codex SDK/CLI 0.159.0, and Pi 0.87.1. Gemini CLI is an
external prerequisite; its headless flags are reviewed against stable 0.62.0.
Claude Code is not used by the Anthropic adapter, which calls the API directly.
Repository agentic workflows pin Copilot CLI 1.0.92 and compile with gh-aw 0.91.1.

### Choosing an integration

| Engine | Best fit | Tool execution | Output enforcement |
|---|---|---|---|
| Copilot | Coding agents and GitHub Agentic Workflows | Runtime tools plus Rig handlers and delegated Rig agents | SDK `responseSchema`, then Rig validation |
| Anthropic | Direct Claude API calls with application-owned tools | SDK beta tool runner executes Rig handlers; no built-in shell/filesystem tools | Native compatible object schemas, then Rig validation |
| Codex | OpenAI coding-agent CLI inside a repository | Codex runtime tools; no in-process Rig handlers | SDK `outputSchema`, then Rig validation |
| Gemini | Installed Gemini coding-agent CLI | Gemini runtime tools; no in-process Rig handlers | Prompt schema and Rig validation/repair |
| Pi | Multi-provider, application-owned agent loops | Pi agent core executes Rig handlers; no built-in shell/filesystem tools | Prompt schema and Rig validation/repair |

Use the official stateful SDK/agent loop rather than spawning a separate CLI
for each turn when one is available. Codex's TypeScript SDK itself wraps its
CLI; retaining its `Thread` is the supported conversation interface. Gemini's
stable headless CLI is preferable here to its experimental ACP interface or
internal core imports. It runs one process per turn, closes unused stdin, and
resumes the exact saved session, never `"latest"`.

Rig `agents` are implemented as Rig tools, so Codex and Gemini also reject
delegated Rig agents. Use TypeScript `workflow()` orchestration to coordinate
separate calls on those engines. Anthropic and Pi need explicitly supplied
tools for operations such as shell commands or file access: `p.*` intents alone
do not provide executable tools.

Choose a model ID supported by the selected provider; `"small"` is not a
portable provider model ID. Auto-selection only selects the engine, not a
replacement model. Copilot's Agentic Workflows provider configuration can
supply its own resolved model. For other engines, set `model` explicitly.

All optional engines reject overlapping turns on a single adapter and
pre-aborted requests. `close()` aborts outstanding work, waits for settlement,
and prevents later requests. Conversations persist only within the invocation
(including repair turns); each new invocation creates a new adapter.
Copilot disconnects its session and stops its client, including when session
creation fails. The HTTP endpoint itself remains externally owned.

Anthropic's native output helper closes object schemas and transforms
unsupported constraints into descriptions. Rig still validates the original
schema. Records, unconstrained fields, untyped enum schemas, and non-object
root outputs stay prompt-driven rather than being silently narrowed or causing
SDK schema-transformation errors. Native structured-output requests require a
model that supports the feature; provider errors are propagated, not retried
with weakened enforcement.

Gemini's Rig `systemMessage` is prepended to the first user prompt, not installed
as a provider system instruction. For a true CLI system-prompt override, set
`env: { GEMINI_SYSTEM_MD: "/absolute/path/to/system.md" }` on the engine; this
**replaces** Gemini's built-in instructions. Prefer project `GEMINI.md` context
when the built-in tool and safety instructions should remain intact.

Copilot currently uses `approveAll`; use it only in a trusted, appropriately
sandboxed runtime where managed settings permit that handler. Codex thread
options and Gemini `approvalMode` retain their provider defaults unless
explicitly configured. Anthropic and Pi handlers run in the host process, so
their allowed operations must be constrained by the application.

### Official integration references

Reviewed on 2026-10-06. Keep stable dependency versions rather than blindly
following npm `latest`, which can point to an alpha or nightly release.

- [Copilot Node SDK](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md) — transport, session lifecycle, tool registration, and response schemas.
- [Anthropic tool runner](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/lib/tools/BetaToolRunner.ts) and [JSON Schema helper](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/helpers/beta/json-schema.ts) — the runner is still beta; the stable Messages API does not provide this loop.
- [Codex TypeScript SDK](https://github.com/openai/codex/blob/rust-v0.160.1/sdk/typescript/README.md) — current stable CLI guidance confirms the existing thread integration.
- [Gemini headless mode](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/docs/cli/headless.md), [CLI flags](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/packages/cli/src/config/config.ts), and [system prompts](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/docs/cli/system-prompt.md) — JSON envelopes, session IDs, and prompt overrides.
- [Pi agent core](https://github.com/earendil-works/pi/blob/v0.87.1/packages/agent/README.md) — model registry, stateful prompting, tool execution, and cancellation.

Agentic workflow provider settings come from
`GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON`: `model`, `providers` (each with `name`
and `baseUrl`), and `models` (each with `id` and `provider`). Invalid JSON or
missing required fields fail explicitly instead of falling back to another model.

## Debug logging

Set `RIG_DEBUG` to comma- or whitespace-separated categories. A category includes its descendants, `*` matches all categories, and a leading `-` excludes a match:

```bash
RIG_DEBUG="engine,agent:turn,-engine:copilot:event" node skills/rig/rig.ts src/program.ts
```

Debug records are `rig.*` JSONL events on stderr and never replace the final stdout result.

| Category | Emitted when |
|---|---|
| `launcher:start` | CLI starts, with script name and argv |
| `launcher:program` | Root program is resolved (file, stdin, or import mode) |
| `launcher:typecheck` | Typecheck starts, passes, or fails |
| `launcher:result` | Root result is rendered to stdout |
| `agent:invoke` / `agent:turn` / `agent:response` | Agent call starts, each turn prompt, each raw response |
| `agent:parse` | Response parse/validation outcome (`parse`, `validation`, `ok`) |
| `agent:tools` | Tools registered on an agent spec |
| `agent:complete` / `agent:retry` / `agent:error` / `agent:failure` / `agent:close` | Agent lifecycle outcomes |
| `workflow:event` | Every workflow event (`run_start`, `phase_start`, `agent_start`, `log`, …) |
| `engine:select` | Default engine selection |
| `engine:copilot:*` | Copilot session create, event, ask, response, close |
| `engine:anthropic:*` / `engine:pi:*` | Engine create, ask, response, tool call, close |
| `engine:codex:*` / `engine:gemini:*` | Engine create, ask, response, close |

## Operational conventions

- Assume Node.js 24.
- Prefer Node native APIs, including built-in `fetch` and glob support, before adding dependencies.
- Prefer `google/zx` (`import { $ } from "zx"`) for shell-style TypeScript automation.
- Keep stdout for program output; runtime lifecycle/request events may be emitted as JSONL on stderr.
