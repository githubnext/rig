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

Compose a single `/** ... */` TSDoc block to place at lines 1–N of the file
(before the first `import`). The header must:

- Start with `@file skills/rig/rig.ts`
- Include `@last-analyzed <short-sha>  @edit-time <ISO-timestamp>` on the second line
  (using the values from Step 2).
- Contain a 2–4 sentence **summary** of the file's purpose and role in the project.
- List every public export in a compact table format: `name — kind — one-liner`.
  Group by category: Schema Types, Schema Helpers (`s.*`), Prompt Helpers (`p.*`),
  Agent Core, Engine, Utilities.
- Call out any **new** exports that do not appear in the old header (if a header
  existed). Mark them clearly as `[NEW]`.
- Describe the 3–5 most important **patterns** or **invariants** an agent must know
  (e.g. shape descriptor promotion, optional trailing `_` key convention, repair
  addon re-prompt contract, `p.*` as declarative intent not executed in-process).
- Be dense — every line should carry information. No filler sentences.
- Keep total length within 80 lines to stay within the 150-line read window along
  with the opening imports.

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
