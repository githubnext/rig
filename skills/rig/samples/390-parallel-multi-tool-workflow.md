# 390 - Parallel Multi-Tool Workflow

```rig
import { workflow, agent, p, s } from "rig";

// Agent role: Count files by extension in the workspace.
const fileCountAgent = agent({
  model: "small",
  output: s.object({
    extCounts: s.record(s.int),
    totalFiles: s.int,
    topExtension: s.string,
  }),
  instructions: p`Count all files in the workspace by extension (excluding node_modules and .git).
Run: ${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20")}
Return extCounts map from extension to count, totalFiles, and topExtension.`,
});

// Agent role: Count environment variables by category (PATH, LOCALE, CI, HOME, CUSTOM).
const envHealthAgent = agent({
  model: "small",
  output: s.object({
    categories: s.record(s.int),
    totalVars: s.int,
  }),
  instructions: p`Analyze environment variables and group them into categories.
Run: ${p.bash("env | cut -d= -f1 | sort")}
Classify each variable name: PATH (contains PATH), LOCALE (contains LANG/LC_), CI (contains CI/GITHUB/RUNNER), HOME (HOME/USER/SHELL), or CUSTOM.
Return categories map and totalVars count.`,
});

// Workflow role: Run file count and env health agents in parallel, then combine into an overall health report.
const parallelMultiToolWorkflow = workflow({
  meta: { name: "workspaceHealth", description: "Parallel workspace health analysis", phases: ["Measure", "Rate"] },
  body: async ({ call, phase }) => {
    phase("Measure");
    const [fileSummary, envSummary] = await Promise.all([
      call(fileCountAgent, "analyze workspace files"),
      call(envHealthAgent, "analyze environment variables"),
    ]);
    phase("Rate");
    const overallHealth = await call.json(
      `fileSummary=${JSON.stringify(fileSummary)} envSummary=${JSON.stringify(envSummary)}. Rate workspace as "healthy", "degraded", or "unknown".`,
      s.enum("healthy", "degraded", "unknown"),
    );
    return { fileSummary, envSummary, overallHealth };
  },
});

export default parallelMultiToolWorkflow;
```
