# 365 - GH Actions Timing Analyzer V2

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const analyzeWorkflow = defineTool("analyzeWorkflow", {
  description: "Analyze a GitHub Actions workflow YAML file for job/step counts and optimization opportunities.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf8");
      const jobMatches = content.match(/^\s{0,2}[\w-]+:\s*$/gm) ?? [];
      const jobCount = Math.max(1, jobMatches.length - 3);
      const stepMatches = content.match(/^\s+- (name|uses|run):/gm) ?? [];
      const stepCount = stepMatches.length;
      const hasCacheStep = /uses:\s*actions\/cache/.test(content);
      const hasMatrix = /matrix:/.test(content);
      const optimizable = !hasCacheStep || (!hasMatrix && stepCount > 8);
      return { jobCount, stepCount, hasCacheStep, hasMatrix, optimizable };
    } catch {
      return { jobCount: 0, stepCount: 0, hasCacheStep: false, hasMatrix: false, optimizable: false };
    }
  },
});

// Agent role: analyze GitHub Actions workflows for job/step counts and optimization opportunities.
const ghActionsTimingAnalyzer = agent({
  model: "small",
  instructions: p`Analyze all GitHub Actions workflow files for optimization opportunities.

Workflow files:
${p.bash("find .github/workflows -name '*.yml' -o -name '*.yaml' 2>/dev/null | sort || echo ''")}

Steps:
1. For each workflow file path, call analyzeWorkflow.
2. Build the workflows array with file, jobCount, stepCount, hasCacheStep, hasMatrix, optimizable.
3. Count totalWorkflows and optimizableCount (optimizable = true).`,
  output: s.object({
    workflows: s.array(s.object({
      file: s.string,
      jobCount: s.number,
      stepCount: s.number,
      hasCacheStep: s.boolean,
      hasMatrix: s.boolean,
      optimizable: s.boolean,
    })),
    totalWorkflows: s.number,
    optimizableCount: s.number,
  }),
  tools: [analyzeWorkflow],
  maxTurns: 6,
  addons: [],
});

export default ghActionsTimingAnalyzer;
```
