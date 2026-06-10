# AGENTS.md

## Project Overview

Rig is a minimal TypeScript agent harness. The core runtime (`skills/rig/rig.ts`) provides declarative agent construction with typed input/output shapes, prompt intents, and a Copilot SDK runtime.

## Architecture

```
skills/rig/rig.ts      — Core runtime (agent, p, copilotEngine, schemas)
skills/rig/samples/    — 51 sample agents demonstrating patterns
src/engines/copilot.test.ts — Copilot engine unit tests (vitest)
src/rig.test.ts        — Unit tests (vitest)
scripts/run-sample.test.ts — Sample runner with a stub Copilot SDK client (dry-run)
skills/rig/SKILL.md    — Framework reference docs
```

All imports use the `"rig"` path alias (resolved via tsconfig paths + vitest alias). `copilotEngine` is exported directly from `rig` for client construction.

## Commands

| Task | Command |
|------|---------|
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Run samples (stub) | `npm run sample` |
| Run single sample (stub) | `RIG_SAMPLE=02 npm run sample` |
| Run a sample for real | `echo "<input>" \| node skills/rig/rig.ts <program-file>` (`npm run sample:run`) |

## Code Style

- Keep the core (`skills/rig/rig.ts`) self-contained; `@github/copilot-sdk` is imported directly in `skills/rig/rig.ts`
- Minimal comments; code should be self-explanatory
- Use `node:` prefix for Node.js built-in imports
- Types are colocated with the module that defines them, not in separate `.d.ts` files
- Trailing underscore on object keys (`key_`) means optional field
- Do not add legacy compatibility bridges; update callers, samples, and docs to the current API

## Testing

- Framework: vitest
- Tests live in `src/rig.test.ts` (agent definition, invocation, validation, and prompt intent coverage)
- Stub the Copilot SDK client with `vi.mock("@github/copilot-sdk", ...)`
- All unit tests must pass before committing
- Samples run via a stub Copilot SDK client that synthesizes shape-conforming output from the prompt's `<output_schema>` block

## Key Concepts

- **Shape descriptors**: JS values used as type exemplars (e.g., `""` = string, `0` = number, `[""]` = string array). Promoted to schemas via `SchemaLike`.
- **Schema helpers (`s.*`)**: `s.string`, `s.number`, `s.boolean`, `s.unknown`, `s.array`, `s.object`, `s.record`, `s.enum`, `s.optional`
- **Prompt intents (`p.*`)**: `p.bash(cmd)`, `p.read(path)`, `p.write(path, content)` — declarative placeholders resolved into prompt instructions, not executed in-process
- **Prompts**: `p\`...\`` template tag composes instructions with inline `p.*` helpers
- **Runtime transport**: Copilot SDK sessions are created by the harness; use launcher `--server` to switch to stdio transport.
- **Repair**: built-in addon re-prompts on parse/validation failure up to `maxTurns`, and other addons can still steer retry prompts.

## Sample guide

- `20-issue-reproducer.ts` — chained diagnosis, fix planning, and review
- `36-subagent-delegation.ts` — focused-agent delegation
- `47-prompt-intents.ts` — prompt intent primitives
- `50-end-to-end-release-agent.ts` — end-to-end release workflow orchestration
