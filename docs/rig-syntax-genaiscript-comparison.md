# Rig syntax comparison: GenAIScript `.genai.js` samples

This review compares current `rig` syntax with 10 representative `.genai.js` samples found on GitHub on 2026-05-31.
The set mixes Microsoft-owned and community repositories that use GenAIScript's `script(...)`, `$`` prompt, `def(...)`, `defSchema(...)`, `defAgent(...)`, and `env/workspace/github` conventions.

## Syntax mapping

| GenAIScript pattern | Rig pattern | Notes |
|---|---|---|
| `script({ ... })` | `agent({ ... })` | `rig` puts name, model, instructions, schemas, and subagents in one declaration. |
| `$` template prompt | `instructions: p\`...\`` or a plain string | Both are readable; `rig` keeps prompt text inside the agent spec. |
| `def("NAME", value)` | `${p.read(...)}`, `${p.bash(...)}`, or inline prompt text | `rig` favors explicit prompt intents over mutable prompt variables. |
| `defSchema(...)` with JSON Schema | `s.object(...)`, `s.array(...)`, `s.enum(...)`, `s.optional(...)` | `rig` uses one explicit JSON Schema-compatible declaration style across samples and runtime. |
| `defAgent(...)` | `agents: { helper }` | `rig` subagents are declared as normal agents and attached structurally. |
| `workspace.*`, `github.*`, `env.vars.*` | prompt intents plus caller-provided input | `rig` exposes less ambient runtime state and pushes more context into the prompt contract. |
| top-level `await` workflow code | one declarative agent spec | `rig` is smaller and easier to generate, but less imperative for long scripted workflows. |

## Reviewed samples and rig ports

| Sample | Source | Rig port |
|---|---|---|
| glossary generation | [`glossary.genai.js`](https://raw.githubusercontent.com/microsoft/generative-ai-with-javascript/a7abd828d0a7b5d56f6e5450e5b26b250c33a392/docs/scripts/glossary.genai.js) | [`skills/rig/samples/55-genaiscript-glossary-port.md`](../skills/rig/samples/55-genaiscript-glossary-port.md) |
| batch refactor with helper agents | [`refactor.genai.js`](https://raw.githubusercontent.com/sinedied/genaiscript-talk/882eb643d6fcb854d22b939a870b0d0dd53d36da/genaisrc/refactor.genai.js) | [`skills/rig/samples/56-genaiscript-refactor-batch-port.md`](../skills/rig/samples/56-genaiscript-refactor-batch-port.md) |
| GitHub issue review | [`issue-review.genai.js`](https://raw.githubusercontent.com/sinedied/genaiscript-talk/882eb643d6fcb854d22b939a870b0d0dd53d36da/genaisrc/issue-review.genai.js) | [`skills/rig/samples/57-genaiscript-issue-review-port.md`](../skills/rig/samples/57-genaiscript-issue-review-port.md) |
| multi-agent travel plan | [`travel.genai.js`](https://raw.githubusercontent.com/sinedied/genaiscript-talk/882eb643d6fcb854d22b939a870b0d0dd53d36da/genaisrc/travel.genai.js) | [`skills/rig/samples/58-genaiscript-travel-plan-port.md`](../skills/rig/samples/58-genaiscript-travel-plan-port.md) |
| file-backed city extraction | [`cityinfo.genai.js`](https://raw.githubusercontent.com/darbotlabs/genaid/46c02f2e23082cb9c244483c9f36dd39212101b2/packages/sample/genaid/cityinfo.genai.js) | [`skills/rig/samples/59-genaiscript-city-info-port.md`](../skills/rig/samples/59-genaiscript-city-info-port.md) |
| schema-only city generator | [`defschema.genai.js`](https://raw.githubusercontent.com/darbotlabs/genaid/46c02f2e23082cb9c244483c9f36dd39212101b2/packages/sample/genaid/defschema.genai.js) | [`skills/rig/samples/60-genaiscript-schema-cities-port.md`](../skills/rig/samples/60-genaiscript-schema-cities-port.md) |
| workspace file picker | [`list-files.genai.js`](https://raw.githubusercontent.com/darbotlabs/genaid/46c02f2e23082cb9c244483c9f36dd39212101b2/packages/sample/genaid/list-files.genai.js) | [`skills/rig/samples/61-genaiscript-list-files-port.md`](../skills/rig/samples/61-genaiscript-list-files-port.md) |
| TODO implementation helper | [`todo.genai.js`](https://raw.githubusercontent.com/darbotlabs/genaid/46c02f2e23082cb9c244483c9f36dd39212101b2/packages/sample/genaid/todo.genai.js) | [`skills/rig/samples/62-genaiscript-todo-port.md`](../skills/rig/samples/62-genaiscript-todo-port.md) |
| slide deck generator | [`slides.genai.js`](https://raw.githubusercontent.com/darbotlabs/genaid/46c02f2e23082cb9c244483c9f36dd39212101b2/packages/sample/genaid/slides.genai.js) | [`skills/rig/samples/63-genaiscript-slide-deck-port.md`](../skills/rig/samples/63-genaiscript-slide-deck-port.md) |
| code review persona | [`review-code.genai.js`](https://raw.githubusercontent.com/sinedied/grumpydev-mcp/7310acbda1b82a41e2f6b31bd064f612f169d6fc/genaisrc/review-code.genai.js) | [`skills/rig/samples/64-genaiscript-grumpy-review-port.md`](../skills/rig/samples/64-genaiscript-grumpy-review-port.md) |

## JSON schema syntax review of the ports

All 10 ports are now reviewed against the current rig schema style (explicit `s.*` declarations that serialize to JSON Schema):

1. **55 glossary**: uses `s.object` with nested `s.array(s.object(...))` for strict term/definition pairs.
2. **56 refactor batch**: both root and helper agents use explicit object schemas for deterministic subagent handoff.
3. **57 issue review**: output shape is explicit (`summary` + `questions`) and consistent with prompt constraints.
4. **58 travel plan**: helper-agent and root-agent outputs are all explicitly typed with `s.object` + `s.array`.
5. **59 city info**: uses `s.array(s.object(...))` to enforce strongly typed tabular extraction.
6. **60 schema cities**: mirrors 59 and keeps the generated records schema-first.
7. **61 list files**: simple but explicit array-of-strings contract for stable tooling consumption.
8. **62 TODO**: nested object-array schema keeps file/plan entries constrained and machine-readable.
9. **63 slide deck**: deep nested schema (`slides[].title/bullets[]`) is explicit and unambiguous.
10. **64 grumpy review**: fixed shape (`findings[]`, `verdict`) keeps persona output structured.

The reviewed set no longer relies on deprecated shorthand forms; it consistently uses canonical `s.*` schema declarations.

## What GenAIScript makes easy

1. Very fast top-level scripting with ambient helpers such as `workspace`, `github`, and `env`.
2. Natural imperative flows: find files, read them, call the model, then write output.
3. JSON Schema reuse through `defSchema(...)` without translating into another schema DSL.
4. Prompt assembly is concise when a script mostly glues inputs into one `$`` block.

## What rig makes easier

1. One canonical declaration shape: `agent({ name, model, instructions, output, agents })`.
2. Smaller syntax surface for generated code: `agent`, `s`, and `p` cover most examples.
3. Stronger schema readability for common cases because `s.object(...)` and `s.enum(...)` stay compact.
4. Cleaner separation between prompt contract and host-side side effects.
5. Better sample consistency because subagents use the same syntax as root agents.

## Rig weaknesses exposed by the comparison

1. File discovery is awkward compared with `workspace.findFiles(...)`; ports fall back to shell commands inside `p.bash(...)`.
2. There is no first-class equivalent to ambient `env.vars` sample parameters in inline markdown examples, so some ports must inline example values.
3. `rig` lacks a direct artifact-oriented pattern like GenAIScript's read/process/write script flow, which makes output-file generation examples less natural.
4. Raw JSON Schema copy/paste from external examples still needs translation into `s.*` helpers.
5. Long imperative workflows are harder to express directly because `rig` intentionally centers one agent spec over step-by-step runtime code.

## GenAIScript weaknesses exposed by the comparison

1. The ambient runtime (`env`, `workspace`, `github`, globals) is powerful but broad, which makes generation drift more likely.
2. Sample syntax mixes metadata, prompt text, file IO, agent definitions, and side effects at top level.
3. Reusing helper agents and schemas adds extra concepts (`def`, `defAgent`, `defSchema`) that beginners must learn quickly.
4. Output contracts rely more often on prompt wording and JSON Schema snippets than on one obvious canonical declaration shape.

## Follow-ups to improve rig

1. Add a first-class `p.glob(...)` or `p.findFiles(...)` helper so workspace enumeration does not require shell `find` commands.
2. Add a lightweight sample metadata helper for common patterns such as file-backed context, canned inputs, and generated artifact descriptions.
3. Document a canonical "generate artifact" pattern that combines `p.read(...)`, strict output schemas, and `p.write(...)` instructions.
4. Add one official multi-agent orchestration sample that mirrors GenAIScript's `defAgent(...)` style more directly.
5. Document JSON Schema to `s.*` translation rules for users porting prompts from GenAIScript or similar tools.
