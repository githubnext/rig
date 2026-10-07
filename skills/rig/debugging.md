# Debug logging

Read when diagnosing launch, agent, workflow, or engine failures.

Set `RIG_DEBUG` to comma- or whitespace-separated categories. Each includes
its descendants; `*` matches all, and a leading `-` excludes a category.

```bash
RIG_DEBUG="engine,agent:turn,-engine:copilot:event" node skills/rig/rig.ts src/program.ts
```

Records are `rig.*` JSONL events on stderr, never the final stdout result.
Do not log credentials. For SDK credential handoff requirements, read
[Agentic Workflows](./agentic-workflows.md).

| Category | Emitted when |
|---|---|
| `launcher:start` | CLI starts, with script name and argv |
| `launcher:program` | Root resolves in file, stdin, or import mode |
| `launcher:typecheck` | Typechecking starts, passes, or fails |
| `launcher:result` | Root result is rendered to stdout |
| `agent:invoke` / `agent:turn` / `agent:response` | Agent call, turn prompt, raw response |
| `agent:parse` | Parse/validation outcome: `parse`, `validation`, `ok` |
| `agent:tools` | Tools registered on an agent |
| `agent:complete` / `agent:retry` / `agent:error` / `agent:failure` / `agent:close` | Agent lifecycle outcomes |
| `workflow:event` | Every workflow event: `run_start`, `phase_start`, `agent_start`, `log`, etc. |
| `engine:select` | Default engine selection |
| `engine:copilot:*` | Session create, event, ask, response, close |
| `engine:anthropic:*` / `engine:pi:*` | Engine create, ask, response, tool call, close |
| `engine:codex:*` / `engine:deepseek:*` / `engine:gemini:*` | Engine create, ask, response, close |
