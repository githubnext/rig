---
name: Daily Rig Sampler
description: >
  Each day, pick five rig samples (cached round-robin) from src/samples/,
  run each with the rig skill, analyze harness performance across all five,
  and apply one focused quick-win improvement to skills/rig/rig.ts in a new draft PR.
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
timeout-minutes: 30
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
    title-prefix: "[rig-sampler] "
    labels: [automation, ai-agent]
    draft: true
    reviewers: [copilot]
    max-patch-size: 1024
    allowed-files:
      - "skills/rig/rig.ts"
      - "src/rig.test.ts"
---

## Task

You are improving the rig TypeScript harness one focused change at a time.

### Step 1 — Pick the next five samples (cached round-robin)

1. Run `ls src/samples/` to list all sample files sorted alphabetically.
2. Open the cache-memory file `/tmp/gh-aw/cache-memory/last-sample.json`.
   - If it does not exist, start from the first file.
   - Otherwise read the `lastFile` field and advance to the next file in the sorted list (wrapping around).
3. Select the next **5** consecutive files from that position (wrapping around the list as needed).
4. Write `{"lastFile": "<fifth-chosen-file>"}` back to `/tmp/gh-aw/cache-memory/last-sample.json`.
5. Note the five chosen sample file paths, e.g. `src/samples/05-write-readme-intent.ts` through `src/samples/09-*.ts`.

### Step 2 — Install dependencies and run all five samples

1. Run `npm install` in the repository root to ensure all dependencies are present.
2. For each of the five chosen samples, run it through the rig skill launcher:
   ```
   node skills/rig/rig.ts <sample-path> 2>&1
   ```
   Capture both stdout (the agent's structured JSON output) and stderr (JSONL event lines prefixed with `rig.copilot-ask`).
3. Record the full output for each sample separately for analysis.

### Step 3 — Analyze harness performance across all five runs

With the captured run outputs, evaluate for each sample:

- **Did it succeed?** Did the agent return valid JSON matching the declared output schema, or did it fail?
- **Repair turns**: Count how many times the harness had to retry due to invalid JSON or schema violations (`rig.copilot-ask` events with `turns > 1`).
- **Turn count and latency**: Note total turns from the JSONL events.
- **Schema fit**: Did the sample's output schema feel too loose (e.g. plain `s.string` where a structured type would help) or too strict (repair loops due to enum mismatches)?
- **Error messages**: Were any error messages unclear or unhelpful?
- **API ergonomics**: Was there anything awkward in how the sample had to express its intent — boilerplate that a helper could eliminate, or a missing convenience on `p.*` or `s.*`?

### Step 4 — Read rig.ts

Read `skills/rig/rig.ts` in full to understand the current implementation.

### Step 5 — Identify one quick-win improvement

Based on your analysis across all five runs, identify **exactly one** small, self-contained improvement to `skills/rig/rig.ts`.

Good categories (pick the one most directly supported by the run evidence):
- A missing `s.*` schema helper that would simplify sample code or prevent a repair loop.
- A clearer error message surfaced during repair or schema validation.
- A JSDoc comment on a public export that is currently undocumented.
- A small type-safety improvement (stricter overload, narrower generic).
- A minor performance or usability tweak with no behaviour change.

Do **not** change the public API in a breaking way. Keep the change small and reviewable.

### Step 6 — Apply the improvement

Edit `skills/rig/rig.ts` to implement the improvement. Use the `edit` tool.
If the change adds or modifies exported API, also update `src/rig.test.ts` to cover it.

### Step 7 — Create a pull request

Emit a `create-pull-request` output with:
- `title`: one-line description of the improvement (no prefix needed — it is added automatically).
- `body`: list the five samples that were run, summarize what each run revealed (repair turns, output quality, etc.), and explain why this change improves the harness.
- `branch`: `rig-sampler/<first-sample-basename>` (e.g. `rig-sampler/05-write-readme-intent`).
