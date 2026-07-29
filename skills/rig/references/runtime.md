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
- `copilotEngine(options)` accepts Copilot client options plus `server` and `connection`. It supports Rig tools and uses the Copilot SDK HTTP transport by default; launcher `--server` selects stdio.
- `piEngine({ provider, models? })` uses `@earendil-works/pi-agent-core`, requires a provider for model lookup, and supports Rig tools.
- `anthropicEngine(options)` uses `@anthropic-ai/sdk`, reads `ANTHROPIC_API_KEY`, supports Rig tools, and accepts `maxTokens` and `maxIterations`.
- `codexEngine(options)` uses `@openai/codex-sdk`, accepts thread options under `thread`, preserves the thread across repair turns, maps Rig system messages to developer instructions, and forwards structured output schemas. It rejects Rig tools because the SDK does not expose custom tool registration.
- `geminiEngine(options)` runs an installed Gemini CLI in headless JSON mode and resumes its session across repair turns. It accepts `command`, `cwd`, CLI `args`, environment variables, and `approvalMode`; it rejects Rig tools because the CLI does not expose registration.

## Debug logging

Set `RIG_DEBUG` to comma- or whitespace-separated categories. A category includes its descendants, `*` matches all categories, and a leading `-` excludes a match:

```bash
RIG_DEBUG="engine,agent:turn,-engine:copilot:event" node skills/rig/rig.ts src/program.ts
```

Debug records are `rig.*` JSONL events on stderr and never replace the final stdout result.

## Operational conventions

- Assume Node.js 24.
- Prefer Node native APIs, including built-in `fetch` and glob support, before adding dependencies.
- Prefer `google/zx` (`import { $ } from "zx"`) for shell-style TypeScript automation.
- Keep stdout for program output; runtime lifecycle/request events may be emitted as JSONL on stderr.
