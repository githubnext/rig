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
- accepts an agent, string, or prompt builder as the default export
- injects `import { agent, p, s } from "rig"` when omitted
- accepts a root with no `input`, `input: s.object({})`, or the default `s.string` input invoked with `""`
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

Add `--server` in either mode to start the Copilot server over stdio. Without it, `copilotEngine()` connects over HTTP using `COPILOT_SDK_URI`, then `localhost:7777`.

## Typechecking

`--typecheck` validates and exits without creating runtime sessions or invoking the root:

```bash
cat program.ts | node skills/rig/rig.ts --typecheck
echo "Review this diff" | node skills/rig/rig.ts src/program.ts --typecheck
```

Success prints `typecheck passed` and exits 0. Failure reports TypeScript diagnostics.

For a standalone `.ts` program outside an ESM package, the launcher uses a temporary `.mts` shadow. Relative sibling imports still require the program directory or an ancestor to contain `{"type":"module"}` in `package.json`.

## Agent interface

Adapters implement the SDK-neutral interface:

```ts
interface Agent {
  ask(prompt: string, options?: { signal?: AbortSignal }): Promise<string>;
  close(): Promise<void>;
}
```

Register a factory with `configureAgent(factory)`. Rig creates one adapter instance per invocation and preserves it across repair turns.

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
  - `ANTHROPIC_API_KEY` → `anthropicEngine()`
  - `OPENAI_API_KEY` → `codexEngine()`
  - `GEMINI_API_KEY` or `GOOGLE_API_KEY` → `geminiEngine()`
  - otherwise → `copilotEngine()`
  - set `RIG_ENGINE` (`copilot` | `anthropic` | `codex` | `gemini`) to force a specific default.
- `copilotEngine()` uses the Copilot SDK HTTP transport by default; launcher `--server` selects stdio.
- `piEngine({ provider })` uses `@earendil-works/pi-agent-core` and requires a provider for model lookup.
- `anthropicEngine()` uses `@anthropic-ai/sdk` and reads `ANTHROPIC_API_KEY`.
- `codexEngine(options)` uses `@openai/codex-sdk`, accepts thread options under `thread`, preserves the thread across repair turns, and maps Rig system messages to developer instructions. It rejects Rig tools because the SDK does not expose custom tool registration.
- `geminiEngine(options)` runs an installed Gemini CLI in headless JSON mode and resumes its session across repair turns. It accepts `command`, `cwd`, CLI `args`, environment variables, and `approvalMode`; it rejects Rig tools because the CLI does not expose registration.

## Operational conventions

- Assume Node.js 24.
- Prefer Node native APIs, including built-in `fetch` and glob support, before adding dependencies.
- Prefer `google/zx` (`import { $ } from "zx"`) for shell-style TypeScript automation.
- Keep stdout for program output; runtime lifecycle/request events may be emitted as JSONL on stderr.
