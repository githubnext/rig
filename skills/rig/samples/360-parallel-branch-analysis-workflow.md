# 360 - Parallel Branch Analysis Workflow

Uses `parallel(thunks)` — rig's equivalent of `parallel(thunks)` in Claude
dynamic workflows. `parallel` respects the shared concurrency limiter and
converts failures to `null` holes. Use it instead of `Promise.all` when porting
a Claude dynamic workflow.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping.

```rig
import { agent, p, s, workflow } from "rig";

const metric = s.object({ label: s.string, value: s.number });

// Agent role: measure branch staleness as a labeled metric.
const branchAgent = agent({ model: "small", output: metric,
  instructions: p`Count stale/total branches.\n${p.bash("git branch -a 2>/dev/null || echo ''")}` });

// Agent role: measure average commits per day over the last 30 days.
const commitAgent = agent({ model: "small", output: metric,
  instructions: p`Count commits per day.\n${p.bash("git log --since='30 days ago' --format='%h' 2>/dev/null | wc -l || echo 0")}` });

// Workflow role: run branch and commit agents in parallel, then synthesize a health rating.
const analysis = workflow({
  meta: { name: "repoHealth", description: "Parallel repo health analysis", phases: ["Measure", "Rate"] },
  body: async ({ call, parallel, phase }) => {
    phase("Measure");
    const [branches, commits] = await parallel([
      () => call(branchAgent, "measure"),
      () => call(commitAgent, "measure"),
    ]);
    phase("Rate");
    return call.json(
      `branches=${JSON.stringify(branches)} commits=${JSON.stringify(commits)}. Rate as "healthy", "needs-attention", or "critical".`,
      s.enum("healthy", "needs-attention", "critical"),
    );
  },
});

export default analysis;
```
