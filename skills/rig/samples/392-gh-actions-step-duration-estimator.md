# 392 - GitHub Actions Step Duration Estimator

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: estimate the execution duration of each step in GitHub Actions workflow files,
// classify steps as fast/medium/slow/unknown, and identify bottlenecks.
const ghActionsStepDurationEstimator = agent({
  model: "small",
  instructions: p`Analyze all GitHub Actions workflow files to estimate step durations.
Workflow files: ${p.glob(".github/workflows/*.yml")}
For each file call readWorkflowFile, then for each step call estimateStepDuration.
Produce a record keyed by filename with estimatedMinutes, bottleneck step, and whether it's optimizable.`,
  tools: [
    defineTool("readWorkflowFile", {
      description: "Read a GitHub Actions YAML workflow file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        return { filePath, content };
      },
    }),
    defineTool("estimateStepDuration", {
      description: "Classify a workflow step duration based on its name/uses/run field",
      parameters: s.object({
        stepName: s.string,
        uses: s.optional(s.string),
        run: s.optional(s.string),
      }),
      handler({ stepName, uses, run }) {
        const text = `${stepName} ${uses ?? ""} ${run ?? ""}`.toLowerCase();
        let durationClass: "fast" | "medium" | "slow" | "unknown";
        if (/checkout|setup|cache/.test(text)) durationClass = "fast";
        else if (/build|compile|install|npm ci/.test(text)) durationClass = "slow";
        else if (/test|lint|typecheck/.test(text)) durationClass = "medium";
        else durationClass = "unknown";
        return { stepName, durationClass };
      },
    }),
  ],
  output: s.object({
    workflows: s.record(
      s.object({
        estimatedMinutes: s.number,
        bottleneck: s.string,
        optimizable: s.boolean,
      }),
    ),
    totalWorkflows: s.int,
  }),
  addons: [steering()],
});

export default ghActionsStepDurationEstimator;
```
