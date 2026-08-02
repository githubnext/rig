# 360 - Parallel Branch Analysis Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: analyze git branch count and classify active vs stale branches.
const branchHealthAgent = agent({
  model: "small",
  instructions: p`Analyze git branches and classify active vs stale.

Branch list:
${p.bash("git branch -a 2>/dev/null || echo ''")}

Count totalBranches (all branches listed). List activeBranches as local branch names (lines not starting with "remotes/").
staleCount = totalBranches - activeBranches.length.`,
  output: s.object({
    totalBranches: s.int,
    staleCount: s.int,
    activeBranches: s.array(s.string),
  }),
});

// Agent role: analyze git commit frequency over the last 30 days.
const commitFrequencyAgent = agent({
  model: "small",
  instructions: p`Analyze git commit frequency over the last 30 days.

Commit dates:
${p.bash("git log --since='30 days ago' --format='%ad' --date=short 2>/dev/null || echo ''")}

totalCommits = number of non-empty lines. activeDays = number of unique dates.
averagePerDay = totalCommits / 30.`,
  output: s.object({
    totalCommits: s.int,
    activeDays: s.int,
    averagePerDay: s.number,
  }),
});

// Workflow role: run branch health and commit frequency agents, then synthesize an overall health rating.
const parallelBranchAnalysisWorkflow = workflow({
  meta: { name: "parallelBranchAnalysis", description: "Parallel branch and commit analysis", phases: ["Analyze", "Synthesize"] },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const [branchHealth, commitFrequency] = await Promise.all([
      call(branchHealthAgent, "analyze branch health"),
      call(commitFrequencyAgent, "analyze commit frequency"),
    ]);

    phase("Synthesize");
    const overallHealth = await call.json(
      `Given branchHealth=${JSON.stringify(branchHealth)} and commitFrequency=${JSON.stringify(commitFrequency)},
       classify overallHealth as "healthy" (averagePerDay >= 1 and staleCount < 3),
       "needs-attention" (averagePerDay < 1 or staleCount >= 3), or "critical" (averagePerDay < 0.1 or staleCount >= 10).`,
      s.enum("healthy", "needs-attention", "critical"),
    );

    return { branchHealth, commitFrequency, overallHealth };
  },
});

export default parallelBranchAnalysisWorkflow;

```
