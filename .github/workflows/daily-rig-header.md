---
name: Daily Rig Header Updater
description: >
  Each day, checks whether the agentic file-summary header in skills/rig/rig.ts is
  outdated by comparing the @last-analyzed git SHA embedded in the header against the
  file's current HEAD commit. When the file has changed, the agent reads the first
  150 lines then the full file, generates a dense information-rich header comment, and
  opens a draft PR — skipping the PR when the content shift is less than 10% and no
  new public API symbols were added.
on:
  schedule: daily
  workflow_dispatch:
  skip-if-match: 'is:pr is:open in:title "[rig-header]"'
permissions:
  contents: read
  actions: read
  issues: read
  pull-requests: read
  copilot-requests: write
engine: copilot
strict: true
timeout-minutes: 20
tools:
  github:
    mode: gh-proxy
    toolsets: [default]
  bash: ["*"]
  edit:
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-pull-request:
    title-prefix: "[rig-header] "
    labels: [automation, ai-agent]
    draft: true
    reviewers: [copilot]
    max-patch-size: 4096
    allowed-files:
      - "skills/rig/rig.ts"
---

## Task

You are maintaining the agentic file-summary header at the top of `skills/rig/rig.ts`.
The header is a block comment that packs the maximum useful information about the file
so that any agent reading only the first 150 lines immediately understands the full API
surface, architecture, and key patterns without needing to read the rest of the file.

### Step 1 — Read the first 150 lines

```bash
head -150 skills/rig/rig.ts
```

Extract two things from the output:

- **existing header**: the entire `/** ... */` block at the very top of the file, if
  it exists. If there is no such block (the file starts with `import` statements), note
  that the header is **absent**.
- **@last-analyzed tag**: the value of the `@last-analyzed` line inside the header,
  e.g. `@last-analyzed abc1234`. If absent, note it as **none**.

### Step 2 — Check whether the header is current

```bash
git log --format="%H %aI" -1 -- skills/rig/rig.ts
```

This prints `<full-sha> <ISO-timestamp>` for the last commit that touched the file.
Extract the **short SHA** (first 7 characters) and the **timestamp**.

Compare the extracted `@last-analyzed` short SHA against the current short SHA:

- If they match → the header is already up to date. Emit `noop` and stop.
- If they differ (or the header is absent) → proceed to Step 3.

### Step 3 — Read the full file

```bash
cat skills/rig/rig.ts
```

As you read, build a complete inventory of:

1. **All public `export` symbols** — type aliases, interfaces, classes, functions,
   and const objects. For each, note its name, kind (type / value / class), and a
   one-line description of what it does.
2. **Schema helpers (`s.*`)** — list every key of the `s` object with its purpose.
3. **Prompt helpers (`p.*`)** — list every key of the `p` object / `PromptHelpers`
   type with its purpose, including the template-tag form `p\`...\``.
4. **Agent addons** — any `AgentAddon` factories exported or described in the file.
5. **Key internal patterns** — repair loop, schema validation path, launcher CLI,
   copilot engine wiring — enough to orient an agent reading only the header.
6. **Dependencies** — external imports (`@github/copilot-sdk`, Node built-ins).

### Step 4 — Build the new header

Compose a single `/** ... */` block to prepend to the file (before the first `import`).

**Format rules — strictly agent-optimized:**
- Zero empty lines anywhere inside the block. Every line carries data.
- No prose sentences. Use compact structured notation throughout.
- Line 1: `* @file skills/rig/rig.ts @last-analyzed <sha7> @edit-time <ISO>`
- Line 2: `* @purpose <10-20 word description of what this module is and does>`
- Line 3: `* @deps @github/copilot-sdk; node:path,fs/promises,child_process,util,url`
- Schema types block — one line per type, format `* T:<Name> <kind> <role>`:
  ```
  * T:Json type null|bool|num|str|Json[]|{[k]:Json}
  * T:Schema type union of all schema variants
  * T:InferSchema<T> type TS inference from schema to runtime type
  * T:AgentInputValue<T> type input accepting raw values or PromptIntent/PromptBuilder
  ...
  ```
- Schema helpers block — prefix `* s.`:
  ```
  * s.string/number/boolean SchemaHelperFactory primitives; call as value or fn(desc)
  * s.array(items,desc?) ArraySchema
  * s.object(props,desc?) ObjectSchema; s.optional(inner) marks field optional
  * s.record(valSchema,desc?) RecordSchema keyed by string
  * s.enum(...values|values,desc) EnumSchema
  * s.unknown() unconstrained JSON
  ```
- Prompt helpers block — prefix `* p.`:
  ```
  * p`...` PromptBuilder template tag; interpolates PromptIntent|string|PromptBuilder
  * p.bash(cmd,opts?) PromptIntent bash execution declaration (not run in-process)
  * p.read(path,opts?) PromptIntent file read declaration
  * p.write(path,content,opts?) PromptIntent file write declaration
  ```
- Agent core block:
  ```
  * F:agent(spec) AgentFn<I,O>; spec={name,description,input,output,prompt,addons,maxTurns}
  * F:copilotEngine(opts?) AgentFactory wrapping CopilotClient+RuntimeConnection
  * F:configureAgent(factory) returns Agent{ask(input,opts?),close()}
  * F:launchRigProgram(path,opts?) runs .ts agent file as subprocess
  * F:defineTool(name,config) Tool with handler+parameters schema
  * F:analyzeResponse(resp,schema,name,turn) ResponseAnalysisResult parse+validate
  * F:defaultRepairPrompt(spec,err) string re-prompt on parse/validation failure
  ```
- Addons block (one line each):
  ```
  * addon:repair re-prompts on JSON/schema failure up to maxTurns
  ```
- Key invariants — prefix `* INV:`, one per line, no empty lines:
  ```
  * INV:shape-descriptors JS values promote to schemas ("" → string, 0 → number, [""] → string[])
  * INV:optional-key trailing _ on spec key means optional field
  * INV:prompt-intents p.* are declarative placeholders resolved into prompt text, never executed
  * INV:repair-contract addon intercepts AgentError, appends error to prompt, retries up to maxTurns
  * INV:output-tag model response parsed from <output>...</output> XML tag in assistant message
  ```
- Mark any symbol absent from the old header with `[NEW]` appended inline.
- Keep total line count ≤ 60 so the block fits within the 150-line read window.

### Step 5 — Measure the change

Compare the new header with the existing header (if any):

```
old_lines = number of lines in the existing header (0 if absent)
new_lines = number of lines in the new header
changed_lines = number of lines in the new header that differ from the old header
change_ratio = changed_lines / max(old_lines, new_lines)
has_new_api = true if any [NEW] export was identified in Step 4
```

Decision rules:
- If `has_new_api` is true → **always** proceed to Step 6 (create PR regardless of ratio).
- If `change_ratio >= 0.10` → proceed to Step 6.
- If `change_ratio < 0.10` AND `has_new_api` is false → emit `noop` and stop.

### Step 6 — Apply the header edit

Use the `edit` tool to replace the existing header block (lines 1–N of the old
`/** ... */` block) with the new header. If no header existed, prepend the new
header followed by a blank line before the first `import` statement.

Verify the edit by running:

```bash
head -5 skills/rig/rig.ts
```

The output must start with `/**`.

### Step 7 — Create a pull request

Emit a `create-pull-request` output with:

- `title`: one-line summary, e.g. `Update rig.ts agentic file-summary header (abc1234 → def5678)`.
- `body`: explain what changed since the last header (new exports, changed patterns,
  etc.), include the `change_ratio` and list any `[NEW]` symbols.
- `branch`: `rig-header/<short-sha>` using the **current** HEAD short SHA from Step 2.
