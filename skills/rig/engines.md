# Engines

Read when selecting or configuring an SDK adapter, tools, structured output,
model IDs, or lifecycle behavior. For launch commands, read
[Running programs](./runtime.md); for sidecar credentials and workflow setup,
read [Agentic Workflows](./agentic-workflows.md).

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

An `AgentFactory` receives the resolved `model`, `systemMessage`, and tools.
Register it with `configureAgent(factory)`. Rig creates one adapter per
invocation and preserves it across repair turns.

## Included engines

```ts
import { configureAgent, copilotEngine } from "rig";
import { anthropicEngine } from "rig/engines/anthropic";
import { codexEngine } from "rig/engines/codex";
import { geminiEngine } from "rig/engines/gemini";
import { piEngine } from "rig/engines/pi";

configureAgent(copilotEngine());
// Alternatives:
configureAgent(piEngine({ provider: "anthropic" }));
configureAgent(anthropicEngine());
configureAgent(codexEngine());
configureAgent(geminiEngine());
```

Without `configureAgent(...)`, selection follows this precedence:

| Setting | Engine |
|---|---|
| `COPILOT_SDK_URI` | Copilot |
| `RIG_ENGINE` set to `copilot`, `anthropic`, `codex`, or `gemini` | Explicit engine |
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENAI_API_KEY` | Codex |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Gemini |
| None | Copilot at `localhost:7777` |

Choose a model ID supported by the provider; `"small"` is not portable.
Auto-selection chooses an engine, not a replacement model.

### Choosing an integration

| Engine | Best fit | Tool execution | Output enforcement |
|---|---|---|---|
| Copilot | Coding agents and GitHub Agentic Workflows | Runtime tools, Rig handlers, delegated Rig agents | SDK `responseSchema`, then Rig validation |
| Anthropic | Direct Claude API with application-owned tools | SDK beta tool runner executes Rig handlers; no built-in shell/filesystem tools | Native compatible object schemas, then Rig validation |
| Codex | OpenAI coding-agent CLI inside a repository | Runtime tools; no in-process Rig handlers | SDK `outputSchema`, then Rig validation |
| Gemini | Installed Gemini CLI in headless JSON mode | Runtime tools; no in-process Rig handlers | Prompt schema and Rig validation/repair |
| Pi | Multi-provider, application-owned agent loops | Pi agent core executes Rig handlers; no built-in shell/filesystem tools | Prompt schema and Rig validation/repair |

Rig `agents` are Rig tools, so Codex and Gemini also reject delegated Rig agents.
Use TypeScript workflows to coordinate separate calls on those engines.
Anthropic and Pi need supplied handlers for shell/file operations: `p.*` intents
alone do not provide executable tools.

## Adapter configuration

- `copilotEngine(options)` accepts Copilot client options plus `server` and `connection`. HTTP is the default; launcher `--server` selects stdio. Rig forwards output schemas as `responseSchema`. String system messages append to SDK instructions; SDK `append`, `replace`, and `customize` configurations are also accepted.
- `piEngine({ provider, models? })` uses `@earendil-works/pi-agent-core` and requires a provider for model lookup.
- `anthropicEngine(options)` uses `@anthropic-ai/sdk`, reads `ANTHROPIC_API_KEY`, and accepts `maxTokens` and `maxIterations`. System messages may be strings or Anthropic text-block arrays. Compatible object outputs use `output_config.format` through the SDK JSON Schema helper; other shapes remain prompt-driven.
- `codexEngine(options)` uses `@openai/codex-sdk`, accepts thread options under `thread`, preserves its thread across repair turns, maps Rig system messages to developer instructions, and forwards structured output schemas. Like Copilot, it closes fixed-property objects with `additionalProperties: false`, including nested objects, without changing record schemas. It rejects Rig tools because its SDK does not expose custom tool registration.
- `geminiEngine(options)` accepts `command`, `cwd`, CLI `args`, environment variables, and `approvalMode`. It resumes the exact saved session, never `"latest"`, and rejects Rig tools because the CLI does not expose registration.

Prefer official stateful SDK/agent loops over spawning a CLI per turn when
available. Codex's SDK wraps its CLI; retain its `Thread`. Gemini's stable
headless CLI is preferable to experimental ACP or internal imports; it runs
one process per turn and closes unused stdin.

### Provider-specific behavior

Copilot closes fixed-property output objects with `additionalProperties: false`
before forwarding them to native structured output, including nested objects.
The original schema is not mutated. Explicit record schemas remain unchanged;
support for those schemas depends on the provider.

Anthropic's native output helper closes object schemas and transforms unsupported
constraints into descriptions. Rig still validates the original schema.
Records, unconstrained fields, untyped enums, and non-object roots remain
prompt-driven rather than silently narrowed. Native output requires a supporting
model; provider errors propagate without retrying with weakened enforcement.

Gemini prepends Rig `systemMessage` to the first user prompt, not the provider
system instruction. `env: { GEMINI_SYSTEM_MD: "/absolute/path/to/system.md" }`
**replaces** Gemini's built-in instructions. Prefer project `GEMINI.md` when
built-in tools and safety instructions should remain intact.

Copilot's Agentic Workflows provider settings come from
`GH_AW_COPILOT_SDK_MULTI_PROVIDER_JSON`: `model`, `providers` (each with `name`
and `baseUrl`), and `models` (each with `id` and `provider`).
Its resolved model can override the agent model. Invalid JSON or missing
required fields fail explicitly, not by falling back to another model.

## Lifecycle and permissions

Optional engines reject overlapping turns and pre-aborted requests. `close()`
aborts outstanding work, waits for settlement, and prevents later requests.
Conversations persist only within an invocation, including repair turns.
Copilot disconnects its session and stops its client even if session creation
fails; the external HTTP endpoint remains externally owned.

Copilot uses `approveAll`: use only in a trusted, appropriately sandboxed runtime
where managed settings permit it. Codex thread options and Gemini `approvalMode`
retain provider defaults unless configured. Anthropic and Pi handlers run in
the host process; the application must constrain their operations.

## Versions and official references

Reviewed on 2026-10-06. Keep stable versions instead of blindly following npm
`latest`, which can select alpha or nightly releases.
The standalone skill pins Copilot SDK 1.0.16. Repository dependencies cover
Anthropic SDK 0.129.0, Codex SDK/CLI 0.159.0, and Pi 0.87.1.
Gemini CLI is an external prerequisite, reviewed against stable 0.62.0.
Anthropic calls the API directly, not Claude Code. Repository workflows pin
Copilot CLI 1.0.92 and compile with gh-aw 0.91.1.

- [Copilot Node SDK](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md) — transport, sessions, tool registration, response schemas.
- [Anthropic tool runner](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/lib/tools/BetaToolRunner.ts) and [JSON Schema helper](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/helpers/beta/json-schema.ts) — beta tool loop; the stable Messages API has no loop.
- [Codex SDK](https://github.com/openai/codex/blob/rust-v0.160.1/sdk/typescript/README.md) — stable CLI guidance and thread integration.
- [Gemini headless mode](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/docs/cli/headless.md), [CLI flags](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/packages/cli/src/config/config.ts), and [system prompts](https://github.com/google-gemini/gemini-cli/blob/v0.62.0/docs/cli/system-prompt.md) — JSON output, session resume, prompt overrides.
- [Pi agent core](https://github.com/earendil-works/pi/blob/v0.87.1/packages/agent/README.md) — models, prompting, cancellation.
