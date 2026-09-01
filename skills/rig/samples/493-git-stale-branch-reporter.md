# 493 - Git Stale Branch Reporter

```rig
import { agent, defineTool, p, s } from "rig";

const classifyBranchAge = defineTool("classifyBranchAge", {
  description: "Classify a branch by age based on its last activity description",
  parameters: s.object({ branch: s.string, lastActivity: s.string }),
  handler({ lastActivity }): "fresh" | "aging" | "stale" | "ancient" {
    const l = lastActivity.toLowerCase();
    if (l.includes("second") || l.includes("minute") || l.includes("hour")) return "fresh" as const;
    if (l.includes("day") && !l.includes("week")) return "aging" as const;
    if (l.includes("week") || l.includes("month")) return "stale" as const;
    return "ancient" as const;
  },
});

// Agent role: report on git remote branches sorted by last commit date and classify their age.
const gitStaleBranchReporter = agent({
  model: "small",
  instructions: p`Analyze git branches from ${p.bash("git branch -r --sort=-committerdate --format='%(refname:short) %(committerdate:relative)' 2>/dev/null | head -30 || true")}. Use classifyBranchAge for each branch to determine its freshness status. Return the full report.`,
  output: s.object({
    branches: s.array(s.object({ name: s.string, lastActivity: s.string, status: s.string })),
    staleBranches: s.array(s.string),
    freshCount: s.int,
    staleCount: s.int,
  }),
  tools: [classifyBranchAge],
});

export default gitStaleBranchReporter;
```
