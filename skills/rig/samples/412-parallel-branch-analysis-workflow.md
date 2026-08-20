# 412 - Parallel Branch Analysis Workflow

```rig
import { agent, p, s, workflow } from "rig";

const branchMetric = s.object({
  totalBranches: s.number,
  staleCount: s.number,
  activeBranches: s.number,
});

const commitMetric = s.object({
  totalCommits: s.number,
  activeDays: s.number,
  averagePerDay: s.number,
});

// Agent role: measure branch count and identify stale branches.
const branchHealthAgent = agent({
  model: "small",
  output: branchMetric,
  instructions: p`Count total, stale (>30 days old), and active branches.
${p.bash("git branch -a 2>/dev/null || echo ''")}
${p.bash("git for-each-ref --format='%(refname:short) %(committerdate:relative)' refs/heads/ 2>/dev/null || echo ''")}`,
});

// Agent role: measure commit frequency over the last 30 days.
const commitFrequencyAgent = agent({
  model: "small",
  output: commitMetric,
  instructions: p`Count total commits in last 30 days and estimate active days and average per day.
${p.bash("git log --oneline --since='30 days ago' 2>/dev/null || echo ''")}`,
});

// Workflow role: run branch health and commit frequency agents in parallel, then classify overall health.
// `parallel(thunks)` requires uniform thunk return types; use `Promise.all` for heterogeneous agents.
const parallelBranchAnalysis = workflow({
  meta: { name: "parallelBranchAnalysis", description: "Parallel branch analysis", phases: ["Analyze", "Rate"] },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const [branchHealth, commitFrequency] = await Promise.all([
      call(branchHealthAgent, "analyze"),
      call(commitFrequencyAgent, "analyze"),
    ]);
    phase("Rate");
    const overallHealth = await call.json(
      `Branch health: ${JSON.stringify(branchHealth)}. Commit frequency: ${JSON.stringify(commitFrequency)}. Classify overall health as "healthy", "needs-attention", or "critical".`,
      s.enum("healthy", "needs-attention", "critical"),
    );
    return { branchHealth, commitFrequency, overallHealth };
  },
});

export default parallelBranchAnalysis;
```
