---
name: Daily Rig Task Generator
description: >
  Each day, generates 10 unique agentic tasks (60% reused from cache, 40% new,
  mining samples for inspiration), expands each into a rig sample markdown file
  via a subagent, typechecks each program, then creates a draft PR adding the
  passing sample files to skills/rig/samples/.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  pull-requests: read
  copilot-requests: write
engine: copilot
strict: true
timeout-minutes: 60
tools:
  github:
    mode: gh-proxy
    toolsets: [default]
  bash: ["*"]
  edit:
  cache-memory: true
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-pull-request:
    title-prefix: "[rig-tasks] "
    labels: [automation, ai-agent]
    draft: true
    reviewers: [copilot]
    allowed-files:
      - "skills/rig/samples/*.md"
  create-issue:
    title-prefix: "[rig-tasks] "
    labels: [automation, ai-agent]
    assignees: [copilot]
    close-older-issues: true
---

## Task

You are an agentic harness evaluator. Each day you:

1. Select 10 tasks — 60% (6) reused from a cached task pool, 40% (4) freshly generated.
2. Expand each task into a rig sample markdown file using the `rig-expander` subagent.
3. Typecheck each generated program.
4. Create a draft PR adding the passing sample files to `skills/rig/samples/`.
5. Create an analysis issue summarizing generation results and rig API improvement opportunities.

---

### Step 1 — Load the cached task pool

Read `/tmp/gh-aw/cache-memory/task-pool.json`.

- If the file exists, parse it as `{ "pool": [{ "id": string, "description": string }] }`.
- If it does not exist or cannot be parsed, start with an empty pool: `{ "pool": [] }`.

---

### Step 2 — List existing rig samples for inspiration

```bash
ls skills/rig/samples/
```

Read the filenames (without extensions) to understand what task categories already exist
(e.g., `02-review-git-diff`, `09-classify-issue`, `47-prompt-intents`). Use these as
inspiration — not as tasks to repeat verbatim — when generating new tasks.

Determine the highest existing sample number from the filenames (e.g. `67` from
`67-glob-file-summarizer.md`). New samples will be numbered starting from that value plus 1,
incremented for each task (e.g. 68, 69, 70 …).

---

### Step 3 — Select 10 tasks

**Reused tasks (6 — 60%):**

If the pool has 6 or more entries, pick the 6 oldest entries not run today (if all have
been run today, pick any 6). Record their `id` and `description`.

If the pool has fewer than 6 entries, take all entries from the pool and generate enough
new tasks to reach 10 total (see below).

**New tasks (4 — 40%):**

Use the `task-generator` subagent to propose exactly `(10 - count_of_reused)` new task
descriptions. Pass it:

- The list of sample filenames from Step 2 (to mine for inspiration and avoid duplication).
- The descriptions of existing pool entries (to avoid repeating them).

Each new task must be a different agentic pattern that exercises a distinct aspect of rig
(e.g., `p.bash(...)`, `p.read(...)`, `s.object` with nested fields, `s.enum`, subagents,
custom tools, repair addons, multi-step chaining, etc.).

---

### Step 4 — Install dependencies

```bash
npm install 2>&1
```

---

### Step 5 — Expand and evaluate each task

For each of the 10 selected tasks (reused and new), perform the following steps:

**5a. Generate a detailed prompt.**

Write a one-paragraph prompt that tells the `rig-expander` subagent:

- What the rig program should accomplish (the agentic task).
- What input schema it should expect (if any).
- What output schema it should produce.
- Which rig primitives to exercise (`p.bash`, `p.read`, `s.object`, subagents, tools, etc.).
- The sample number `<NN>` and a short kebab-case title slug for the filename.

**5b. Ask the `rig-expander` subagent to write the program.**

Invoke the `rig-expander` subagent with the prompt from 5a. It will return a JSON object
describing the generated sample, including whether it chose an `agent` or `workflow`
root export and the plain TypeScript source.

**5c. Write the program to a temp file for typechecking.**

Parse the subagent JSON and extract:

- `kind` (`"agent"` or `"workflow"`)
- `source` (plain TypeScript source code with no fence markers)

Write `source` to:

```bash
cat > /tmp/gh-aw/agent/rig-task-<N>.ts << 'EOF'
<source>
EOF
```

(Replace `<N>` with the task index 1–10.)

**5d. Typecheck the program.**

```bash
node skills/rig/rig.ts /tmp/gh-aw/agent/rig-task-<N>.ts --typecheck 2>&1
```

Record whether typecheck passed or failed, any error messages, and a one-line **key finding**
describing what the generated code did well or what went wrong (e.g., unused import, wrong
schema helper, awkward `p.*` usage).

**5e. Write the sample file (only if typecheck passed).**

If typecheck passed, write a markdown sample file to the repository:

```bash
cat > skills/rig/samples/<NN>-<slug>.md << 'EOF'
# <NN> - <Title>

```rig
<source>
```
EOF
```

Where `<NN>` is the sample number assigned in Step 2 (zero-padded to two digits),
`<slug>` is a 2–4 word kebab-case summary of the task, and `<Title>` is a title-case
version of the slug. If typecheck failed, skip writing the file. In Step 7, include
the generated `kind` so results show where workflow export was selected.

---

### Step 6 — Update the cache

Merge new tasks into the pool. For each new task, append
`{ "id": "<short-uuid-8>", "description": "<description>" }` to `pool`.

Trim `pool` to the most recent 50 entries. Write the updated object back to
`/tmp/gh-aw/cache-memory/task-pool.json`.

---

### Step 7 — Create analysis issue

Emit a `create-issue` safe output with:

- **title**: `Daily rig evaluation — <YYYY-MM-DD> — <N_passed>/<N_total> passed`
- **body**: A structured analysis:

  ```markdown
  ## Summary

  | Task | Description | Typecheck | Key finding |
  |------|-------------|-----------|-------------|
  | 1 (new/reused) | … | ✅ pass / ❌ fail | … |
  …

  ---

  ## Problems encountered

  For each typecheck failure, include:
  - What the generated code tried to do and which rig primitives it used.
  - The exact error message(s) from `--typecheck`.
  - Root cause analysis and the fix applied (if any).

  If there were no failures, write "No failures this run."

  ---

  ## Improvement opportunities

  Based on patterns observed across all 10 tasks, identify concrete API improvements:

  ### Missing or undiscoverable schema helpers (`s.*`)
  List cases where a missing `s.*` helper made code verbose, caused typecheck failures,
  or was hard to find in SKILL.md.

  ### Missing or undiscoverable prompt helpers (`p.*`)
  List cases where a missing `p.*` primitive led to verbose workarounds or was commonly
  misused.

  ### Error message quality
  Note any error messages (from `--typecheck` or the harness) that were unclear,
  misleading, or unhelpful for diagnosing the problem.

  ### API ergonomics
  Identify API patterns that were awkward, frequently confused, or required extra
  boilerplate that a helper could eliminate.

  ### Candidate lint rules
  For repeated code patterns that confused the model, propose a focused lint rule.
  Include the proposed rule name, invalid and valid examples, why the pattern is
  model-confusing, and whether a safe autofix is possible. Do not suggest a rule
  for a one-off mistake or an issue already caught by the current linter.

  ### Documentation gaps
  Note anything in SKILL.md or the references that was underdocumented, missing an
  example, or frequently led to wrong usage.

  ---

  ## Tasks run today

  - (new/reused) <description>
  …
  ```

---

### Step 8 — Create a pull request

Emit a `create-pull-request` safe output with:

- **title**: `Add <N_written> rig samples — <YYYY-MM-DD>`
- **body**: A structured summary:

  ```markdown
  ## Summary

  Added <N_written> new rig sample files to `skills/rig/samples/`.

  | # | File | Description | Typecheck |
  |---|------|-------------|-----------|
  | 1 | 68-... | … | pass |
  …

  ## Typecheck failures

  For each task that failed typecheck, describe what the generated code tried to do
  and what error appeared.

  ## Tasks run

  - (new) <description>
  - (reused) <description>
  …
  ```

- **branch**: `rig-tasks/<YYYY-MM-DD>`

If all 10 tasks failed typecheck and no sample files were written, emit `noop` instead.

---

## agent: `task-generator`
---
description: Proposes new unique agentic task descriptions for rig programs, mining the sample list for inspiration and avoiding duplication.
model: small
---
You are a task designer for the rig TypeScript agent harness.

You will receive:
- A JSON array of existing sample filenames (for inspiration only — do NOT repeat them verbatim).
- A JSON array of descriptions already in the task pool (avoid duplicating these).
- A count `N` of how many new tasks to generate.

Generate exactly `N` distinct task descriptions. Each description must:
- Be a different agentic pattern (e.g., one uses `p.bash`, another uses `s.enum`, another
  chains two agents, another uses a custom `defineTool`, another exercises `s.record`, etc.).
- Be 1–2 sentences describing what the rig program should accomplish and what rig
  primitives to use.
- Be novel relative to the existing pool and sample list.

Return a JSON array of description strings, e.g.:
["Classify a list of log lines by severity using s.enum and s.array, reading logs via p.bash.", "…"]

## agent: `rig-expander`
---
description: Expands a task description into a complete rig TypeScript program following the SKILL.md guidelines.
model: large
---
You are an expert in the rig TypeScript agent harness.

Start by reading the current API reference:

```bash
cat skills/rig/SKILL.md
```

You will receive a one-paragraph prompt describing an agentic task, the desired input/output
schema, which rig primitives to use, and a sample number with kebab-case slug.

Your job: write a complete, idiomatic rig TypeScript program that implements the task,
following the API patterns shown in the SKILL.md you just read.

Rules:
- Single `import { ... } from "rig"` using only symbols needed by the program.
- Use `s.object(...)` and explicit `s.*` helpers for all schemas.
- Use `p\`...\`` template tag with `${p.bash(...)}` or `${p.read(...)}` for context.
- Add a `// Agent role: ...` comment above each agent declaration.
- Set `model` explicitly to `"large"`, `"mini"`, or `"small"`.
- Prefer `workflow(...)` as the root export when orchestration is deterministic
  (fan-out/fan-in, branching, reduction, bounded loops). Use a root `agent(...)`
  only when the coordination should remain model-driven.
- `export default` exactly one root object (`agent` or `workflow`). Do NOT call it directly.
- Do not use `console.log`.
- Keep the program under 60 lines.

Return strictly valid JSON with this shape:
{
  "kind": "agent" | "workflow",
  "source": "<complete TypeScript source code>"
}
Do not wrap `source` in markdown fences, and do not add extra keys.
