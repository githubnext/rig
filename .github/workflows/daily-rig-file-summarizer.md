---
name: Daily Rig File Summarizer
description: >
  Each day, runs a rig program that uses a file-summarizer subagent to summarize
  each TypeScript source file individually via the Copilot SDK, synthesizes a global
  project summary, and posts the result as a GitHub issue.
on:
  schedule: daily
  workflow_dispatch:
permissions:
  contents: read
  issues: read
  copilot-requests: write
engine: copilot
features:
  copilot-sdk: true
strict: true
timeout-minutes: 30
tools:
  bash: ["*"]
network:
  allowed: [defaults, github, node]
safe-outputs:
  create-issue:
    title-prefix: "[rig-summarizer] "
    labels: [automation, ai-agent]
    close-older-issues: true
    expires: 7
---

## Task

Run the rig file summarizer program, which uses a Copilot SDK subagent to summarize
each TypeScript source file individually and then synthesizes a global project summary.
Post the result as a GitHub issue.

### Step 1 — Install dependencies

```bash
npm install 2>&1
```

### Step 2 — Run the rig file summarizer

```bash
node skills/rig/rig.ts skills/rig/samples/140-file-summarizer.md 2>&1
```

Capture the JSON output object `{"files":[...],"globalSummary":"..."}` printed to stdout.
If the program exits with a non-zero code, emit `noop` with the error and stop.

### Step 3 — Create an issue

Emit a `create-issue` safe output with:

- **title**: `Daily file summary — <YYYY-MM-DD>`
- **body**: A structured Markdown report following this structure:

  ```markdown
  ### Global Summary

  <globalSummary>

  ### Individual File Summaries

  | File | Summary |
  |------|---------|
  | <path> | <summary> |
  …
  ```
