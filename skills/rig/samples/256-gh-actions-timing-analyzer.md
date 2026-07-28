# 256 - Gh Actions Timing Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseWorkflowSteps = defineTool("parseWorkflowSteps", {
  description: "Parse a GitHub Actions workflow YAML to extract job names, step counts, and detect optimization patterns",
  parameters: s.object({ content: s.string, filename: s.string }),
  handler: ({ content, filename }) => {
    const jobMatches = content.match(/^\s{2}[\w-]+:/gm) ?? [];
    const stepMatches = content.match(/^\s+-\s+(?:name:|uses:|run:)/gm) ?? [];
    const hasCache = /uses:\s+actions\/cache/.test(content) || /cache:/.test(content);
    const hasMatrix = /matrix:/.test(content);
    const hasInstall = /npm (ci|install)|yarn install|pnpm install/.test(content);
    const missingCache = hasInstall && !hasCache;
    const suggestions: string[] = [];
    if (missingCache) suggestions.push("Add actions/cache after install step to speed up builds");
    if (hasMatrix && jobMatches.length === 1) suggestions.push("Matrix found but only one job — consider parallel jobs for different test suites");
    if (stepMatches.length > 15) suggestions.push("Workflow has many steps — consider splitting into reusable workflows");
    return JSON.stringify({ filename, jobs: jobMatches.length, steps: stepMatches.length, hasCache, hasMatrix, suggestions });
  },
});

// Agent role: analyze GitHub Actions workflow files for timing and performance optimization opportunities
const ghActionsTimingAnalyzer = agent({
  name: "ghActionsTimingAnalyzer",
  model: "small",
  addons: repair(),
  tools: [parseWorkflowSteps],
  instructions: p`Analyze GitHub Actions workflow files for performance optimization opportunities.

Workflow files: ${p.glob(".github/workflows/*.yml")}

Workflow contents: ${p.bash("find .github/workflows -name '*.yml' 2>/dev/null | head -10 | xargs cat 2>/dev/null || echo 'No workflows found'")}

For each workflow file, call parseWorkflowSteps with the file content and filename.
Collect results and determine if any workflows are optimizable (have suggestions).
Set optimizable to true if any workflow has suggestions.`,
  output: s.object({
    workflows: s.array(
      s.object({
        file: s.path,
        jobs: s.int,
        steps: s.int,
        hasCache: s.boolean,
        hasMatrix: s.boolean,
        suggestions: s.array(s.string),
      })
    ),
    totalWorkflows: s.int,
    optimizable: s.boolean,
  }),
});

export default ghActionsTimingAnalyzer;
```
