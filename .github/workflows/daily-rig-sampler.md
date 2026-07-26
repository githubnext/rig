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
import { agent, configureAgent, copilotEngine, defineTool, p, s } from "rig";

configureAgent(copilotEngine());

const SampleRun = s.object({
  path: s.path,
  status: s.enum("succeeded", "failed"),
  output: s.string,
  logs: s.array(s.string),
});

const runRigSample = defineTool("run_rig_sample", {
  description: "Execute one Rig sample and capture its stdout and stderr logs.",
  parameters: s.object({ path: s.path }),
  async handler({ path }) {
    const { spawn } = await import("node:child_process");
    const { readFile } = await import("node:fs/promises");
    const { resolve, sep } = await import("node:path");

    const samplesDirectory = resolve("skills/rig/samples");
    const samplePath = resolve(path);
    if (!samplePath.startsWith(`${samplesDirectory}${sep}`) || !samplePath.endsWith(".md")) {
      throw new Error(`Sample path is outside skills/rig/samples: ${path}`);
    }

    const markdown = await readFile(samplePath, "utf8");
    const program = markdown.match(/^```rig[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/m)?.[1];
    if (!program) {
      return { path, status: "failed", output: "", logs: ["No rig fenced block found."] };
    }

    return await new Promise((resolveRun, rejectRun) => {
      const child = spawn(process.execPath, ["skills/rig/rig.ts"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          RIG_DEBUG: "agent:*,engine:copilot:*,-engine:copilot:event",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", rejectRun);
      child.on("close", (code) => {
        resolveRun({
          path,
          status: code === 0 ? "succeeded" : "failed",
          output: stdout.trim(),
          logs: stderr.split("\n").filter(Boolean),
        });
      });
      child.stdin.end(program);
    });
  },
});

// Agent role: execute one Rig sample as a delegated task and record its result.
const runSample = agent({
  name: "sample-runner",
  model: "mini",
  input: s.object({ path: s.path }),
  tools: [runRigSample],
  instructions: p`Call run_rig_sample exactly once with ${p.inputField("path")}.
Return the tool result unchanged. Do not run any other sample.`,
  output: SampleRun,
});

const runRandomSamples = defineTool("run_random_samples", {
  description: "Randomly select five Rig samples and delegate each to sample-runner.",
  parameters: s.object({}),
  async handler() {
    const { randomInt } = await import("node:crypto");
    const { readdir } = await import("node:fs/promises");
    const names = (await readdir("skills/rig/samples"))
      .filter((name) => name.endsWith(".md"));
    if (names.length < 5) {
      throw new Error(`Expected at least 5 Rig samples, found ${names.length}.`);
    }
    for (let index = names.length - 1; index > 0; index -= 1) {
      const other = randomInt(index + 1);
      [names[index], names[other]] = [names[other]!, names[index]!];
    }
    const runs = [];
    for (const name of names.slice(0, 5)) {
      runs.push(await runSample({ path: `skills/rig/samples/${name}` }));
    }
    return { runs };
  },
});

// Agent role: randomly select five Rig samples, delegate every run, and aggregate the results.
const sampleCoordinator = agent({
  name: "sample-coordinator",
  model: "small",
  agents: { runSample },
  tools: [runRandomSamples],
  instructions: "Call run_random_samples exactly once with an empty object and return its result unchanged.",
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
  - Include each sample's final output and exact logs in a separate collapsible
    `<details>` section.
  - Include the exact `rig.*` JSONL runtime log lines captured while running the
    Rig program in a final `### Rig Runtime Logs` section. Group lines by sample
    when attribution is available; otherwise preserve chronological order.
  - Do not invent missing log lines. State clearly when runtime logs were not
    available.
