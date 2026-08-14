# 414 - Parallel Branch Analysis Workflow

```rig
import { agent, p, s, workflow } from "rig";

const repoMetric = s.object({
  label: s.string,
  value: s.number,
  detail: s.string,
});

// Agent role: Analyze branch health and return a labeled metric summarizing branch counts.
const branchHealthAgent = agent({
  model: "small",
  instructions: p`Analyze git branches and report a summary metric.
Branches: ${p.bash("git branch -a")}
Count total and stale branches. Return:
- label: "branch-health"
- value: ratio of active to total branches (0.0 to 1.0)
- detail: JSON string with totalBranches, staleCount, activeBranches as a short summary`,
  output: repoMetric,
});

// Agent role: Analyze commit frequency and return a labeled metric for commits per day.
const commitFrequencyAgent = agent({
  model: "small",
  instructions: p`Analyze git commit frequency over the last 30 days and return a metric.
Commits: ${p.bash("git log --since='30 days ago' --format='%ad' --date=short")}
Count unique commit dates. Return:
- label: "commit-frequency"
- value: average commits per day over 30 days
- detail: JSON string with totalCommits, activeDays`,
  output: repoMetric,
});

// Workflow role: Run branch health and commit frequency analysis in parallel, then classify overall repository health.
const parallelBranchAnalysis = workflow({
  meta: { name: "parallel-branch-analysis", description: "Parallel branch and commit frequency analysis" },
  body: async ({ call, parallel }) => {
    const [branchHealth, commitFrequency] = await parallel([
      () => call(branchHealthAgent, "analyze"),
      () => call(commitFrequencyAgent, "analyze"),
    ]);

    const overallHealth = await call.json(
      `Given metrics ${JSON.stringify([branchHealth, commitFrequency])}, classify overall repository health as "healthy", "needs-attention", or "critical".`,
      s.enum("healthy", "needs-attention", "critical"),
    );

    return { branchHealth, commitFrequency, overallHealth };
  },
});

export default parallelBranchAnalysis;
```
