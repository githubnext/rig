import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: estimate total runtime and identify bottleneck steps in GitHub Actions workflows.
const workflowStepDurationEstimator = agent({
  model: "typecheck",
  instructions: p`You are a GitHub Actions workflow step duration estimator.

Discover workflow files:
${p.glob(".github/workflows/*.yml")}

Read each workflow file and use estimateStepDuration to classify each step's expected duration.
Return the declared output with per-workflow estimates.`,
  tools: [
    defineTool("estimateStepDuration", {
      description: "Classify a workflow step's expected duration based on its name and uses field",
      parameters: s.object({
        stepName: s.string,
        uses: s.optional(s.string),
        run: s.optional(s.string),
      }),
      handler({ stepName, uses, run }) {
        const slow = ["install", "build", "compile", "deploy", "push", "publish", "cache", "docker", "terraform"];
        const medium = ["test", "lint", "check", "validate", "setup", "configure", "upload", "download"];
        const fast = ["checkout", "echo", "env", "version", "tag", "label", "comment"];
        const text = `${stepName} ${uses ?? ""} ${run ?? ""}`.toLowerCase();
        let speed: "fast" | "medium" | "slow" | "unknown";
        let estimatedMinutes: number;
        if (slow.some((k: string) => text.includes(k))) {
          speed = "slow" as const;
          estimatedMinutes = 5;
        } else if (medium.some((k: string) => text.includes(k))) {
          speed = "medium" as const;
          estimatedMinutes = 2;
        } else if (fast.some((k: string) => text.includes(k))) {
          speed = "fast" as const;
          estimatedMinutes = 0.5;
        } else {
          speed = "unknown" as const;
          estimatedMinutes = 1;
        }
        return { speed, estimatedMinutes };
      },
    }),
    defineTool("readWorkflowFile", {
      description: "Read a workflow YAML file and return its content",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        return { filePath, content };
      },
    }),
  ],
  output: s.object({
    workflows: s.record(s.object({
      estimatedMinutes: s.number,
      bottleneck: s.string,
      optimizable: s.boolean,
    })),
    totalWorkflows: s.int,
  }),
  addons: [steering()],
});

export default workflowStepDurationEstimator;
