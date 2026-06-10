# Rig syntax comparison: Copilot SDK APIs and pi-agent SDK

This page compares how `rig` syntax maps to two other harness styles:

- GitHub Copilot SDK APIs (API usage only)
- pi-agent SDK

The focus is generation reliability: what an agent can produce quickly with low ambiguity.

## 1) Syntax mapping overview

| Rig concept | Copilot SDK APIs (only) | pi-agent SDK |
|---|---|---|
| `agent({ name, instructions, input, output })` | App-level session setup + prompt contract + response parsing/validation | Agent definition/config + prompt contract + response parsing/validation |
| `s.object(...)`, `s.enum(...)`, `s.array(...)` | Explicit JSON schema or prompt-constrained JSON validated in app code | Same pattern: schema-constrained JSON validated by the harness/app |
| `p.read(...)`, `p.bash(...)` | Tool/context calls orchestrated by the host app before/within turns | Tool/context calls via pi-agent tool integration/orchestration |
| `agents: { subagent }` | Multiple sessions/roles coordinated in app orchestration | Multi-agent graph/delegation orchestration |
| `maxTurns`, optional `rig/addons` repair addon | Explicit retry + repair loop in app logic | Retry/repair policies in agent workflow/harness |
| `permissions` | Host-side policy gates around shell/write operations | Host-side tool permission policies |

## 2) Top 10 scenarios: Copilot SDK APIs (ranked easiest → hardest)

| Rank | Scenario | Ease/confusion rationale | Rig → Copilot SDK mapping note |
|---:|---|---|---|
| 1 | Single-field summarizer | Minimal schema and deterministic shape keep ambiguity very low. | `output: { text }` maps to one session request and strict JSON parse. |
| 2 | Enum classifier | Closed label sets reduce drift and invalid output. | `s.enum(...)` maps to constrained JSON contract validated after response. |
| 3 | Structured extractor | Input text to typed fields is usually straightforward. | `input/output` schemas map to one-turn extraction with validation. |
| 4 | Diff summary | Slightly larger context but objective remains clear. | Diff as input + structured summary fields in response contract. |
| 5 | Test-log diagnosis | Interpretation complexity rises with noisy logs. | Log input + typed root-cause/next-step schema with validation. |
| 6 | PR triage recommendation | Requires prioritization judgment and policy interpretation. | One/two turns with constrained triage schema and confidence fields. |
| 7 | README draft generation | Creative synthesis adds style and completeness ambiguity. | Multi-section structured output with post-parse checks. |
| 8 | Release notes generation | Requires grouping/dedup across many commits. | Batched commit input + grouped typed output contract. |
| 9 | Schema-repairing extractor | Needs robust retry when output is invalid or partial. | `maxTurns` plus optional `rig/addons` repair addon maps to explicit app-level validation/repair loop. |
| 10 | Multi-agent orchestrator | Highest coordination overhead across roles and merges. | `agents` maps to multi-session orchestration and aggregation logic. |

## 3) Top 10 scenarios: pi-agent SDK (ranked easiest → hardest)

| Rank | Scenario | Ease/confusion rationale | Rig → pi-agent mapping note |
|---:|---|---|---|
| 1 | Issue classification | Tight label set and simple context produce stable output. | `s.enum(...)` maps to constrained classification response schema. |
| 2 | Package script extraction | Deterministic source file extraction is low ambiguity. | `${p.read("package.json")}` maps to file-read tool + typed extraction. |
| 3 | Git diff summary | Clear input artifact, moderate reasoning complexity. | `${p.bash("git diff -- .")}` maps to shell tool + structured summary. |
| 4 | PR triage | Policy interpretation exists but remains bounded by schema. | Enum-heavy triage schema maps well to classifier-style flows. |
| 5 | Release notes draft | Cross-item synthesis introduces grouping ambiguity. | Multi-input retrieval + typed release-note sections. |
| 6 | Security scan review | Severity calibration and false-positive handling increase confusion risk. | Findings ingestion + risk rubric in structured output schema. |
| 7 | CI log diagnosis | Noisy traces and multiple plausible root causes. | Tooled log capture + hypothesis/next-action typed fields. |
| 8 | Flaky test analysis | Nondeterminism and weak signals increase uncertainty. | Repeated evidence aggregation + hypothesis confidence fields. |
| 9 | Subagent delegation planner | Coordination and dependency ordering are hard to generate correctly. | `agents` maps to multi-agent planning/delegation graph. |
| 10 | End-to-end release agent | Long chained workflow with coupled decisions and tools. | Orchestrated multi-step workflow with strict stage outputs. |

## 4) Practical takeaways for lower-confusion generation

1. Start with schema-tight, single-turn tasks first.
2. Prefer enums/literals for decision fields.
3. Keep context acquisition explicit (`read`/`bash`/tool calls) before generation.
4. Add repair loops only when necessary; they increase implementation complexity.
5. Introduce subagents last, after single-agent schema contracts are stable.
