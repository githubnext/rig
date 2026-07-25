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
engine:
  id: copilot
  copilot-sdk: true
strict: true
timeout-minutes: 30
skills:
  - githubnext/rig/skills/rig/SKILL.md@31d2dbdf686db9fa8bcb3fbc1792011faabc0c89
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

Run this rig

```rig
import { agent, configureAgent, copilotEngine, p, s } from "rig";

configureAgent(copilotEngine());

const FileSummary = s.object({ path: s.path, summary: s.string });

// Agent role: read one TypeScript file and return a 1-2 sentence summary.
const summarizeFile = agent({
  name: "file-summarizer",
  model: "mini",
  input: { path: s.path },
  instructions: p`Summarize the following file in 1-2 sentences:\n${p.readInput("path")}`,
  output: FileSummary,
});

// Agent role: discover TypeScript source files, delegate to summarizeFile, then synthesize a global summary.
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
```

Emit a `create-issue` safe output with:

- **title**: `Daily file summary — <YYYY-MM-DD>`
- **body**:

  ```markdown
  ### Global Summary

  <globalSummary>

  ### Individual File Summaries

  | File | Summary |
  |------|---------|
  | <path> | <summary> |
  …
  ```
