---
name: Daily Rig File Summarizer
description: >
  Each day, runs an inline rig program that uses a file-summarizer subagent to summarize
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

Run an inline rig file-summarizer program that uses a Copilot SDK subagent to summarize
each TypeScript source file individually and then synthesizes a global project summary.
Post the result as a GitHub issue.

### Step 1 — Install dependencies

```bash
npm install 2>&1
```

### Step 2 — Write the rig program

```bash
mkdir -p /tmp/gh-aw/agent && cat > /tmp/gh-aw/agent/file-summarizer.ts << 'RIGEOF'
import { agent, configureAgent, copilotEngine, p, s } from "rig";

configureAgent(copilotEngine());

const FileSummary = s.object({ path: s.path, summary: s.string });

const summarizeFile = agent({
  name: "file-summarizer",
  model: "mini",
  input: { path: s.path },
  instructions: p`Summarize the following file in 1-2 sentences:\n${p.readInput("path")}`,
  output: FileSummary,
});

const projectSummarizer = agent({
  name: "project-summarizer",
  model: "small",
  agents: { summarizeFile },
  instructions: p`
List TypeScript source files (excluding node_modules and .git):
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | sort | head -20")}
Call summarizeFile for each file path, then write a concise globalSummary of the whole project.
`,
  output: s.object({
    files: s.array(FileSummary),
    globalSummary: s.string,
  }),
});

export default projectSummarizer;
RIGEOF
```

### Step 3 — Run the rig file summarizer

```bash
node skills/rig/rig.ts /tmp/gh-aw/agent/file-summarizer.ts 2>&1
```

Capture the JSON output object `{"files":[...],"globalSummary":"..."}` printed to stdout.
If the program exits with a non-zero code, emit `noop` with the error and stop.

### Step 4 — Create an issue

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
