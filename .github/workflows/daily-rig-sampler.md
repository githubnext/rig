---
name: Daily Rig Sample Report
description: >
  Randomly selects five Rig samples, delegates each sample to a Rig subagent,
  and reports the results and Rig runtime logs in a GitHub issue.
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
    title-prefix: "[rig-sampler] "
    labels: [automation, ai-agent]
    close-older-issues: true
    expires: 7
---

## Task

Run this Rig program:

```rig
import { agent, configureAgent, copilotEngine, p, s } from "rig";

configureAgent(copilotEngine());

const SampleRun = s.object({
  path: s.path,
  status: s.enum("succeeded", "failed"),
  output: s.string,
  logNotes: s.array(s.string),
});

// Agent role: execute one Rig sample as a delegated task and record its result.
const runSample = agent({
  name: "sample-runner",
  model: "mini",
  input: s.object({ path: s.path }),
  instructions: p`
Execute the Rig sample below as a delegated task using the current repository context.
Follow the root agent's instructions, preserve its final output, and record concise
log notes for important tool calls, turns, repairs, or failures. Do not run any
other sample.

${p.readInput("path")}
`,
  output: SampleRun,
});

// Agent role: randomly select five Rig samples, delegate every run, and aggregate the results.
const sampleCoordinator = agent({
  name: "sample-coordinator",
  model: "small",
  agents: { runSample },
  instructions: p`
These five sample paths were selected randomly:
${p.bash("find skills/rig/samples -maxdepth 1 -type f -name '*.md' -print | shuf -n 5")}

Call runSample exactly once for each listed path. Return one SampleRun for every
path in the same order. Do not replace, skip, or add samples.
`,
  output: s.object({
    runs: s.array(SampleRun),
  }),
});

export default sampleCoordinator;
```

Emit one `create-issue` safe output with:

- **title**: `Daily Rig sample report — <YYYY-MM-DD>`
- **body**:
  - List the five selected sample paths and their success status.
  - Include each sample's final output and log notes in a separate collapsible
    `<details>` section.
  - Include the exact `rig.*` JSONL runtime log lines emitted while running the
    Rig program in a final `### Rig Runtime Logs` section. Group lines by sample
    when attribution is available; otherwise preserve chronological order.
  - Do not invent missing log lines. State clearly when runtime logs were not
    available.
