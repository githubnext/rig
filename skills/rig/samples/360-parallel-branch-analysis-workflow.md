# 360 - Parallel Branch Analysis Workflow

Demonstrates the `parallel(thunks)` pattern from Claude dynamic workflows: fan
out two independent agents, then synthesize their results. Uses `parallel` (not
`Promise.all`) so that a failing agent becomes a `null` hole instead of aborting
the whole run, and both agents share the workflow's concurrency limiter.

```rig
import { agent, p, s, workflow } from "rig";
// Agent role: run a git analysis command and return a structured summary.
const gitAnalyzer = agent({
  input: s.object({ command: s.string("git command to run"), aspect: s.string("what to analyse") }),
  output: s.object({ aspect: s.string, summary: s.string, count: s.int }),
  instructions: p`Run the given git command and summarise the requested aspect. Return a one-sentence summary and the total count.`,
});
// Workflow role: fan out two analysis calls with parallel(thunks) — the Claude
// dynamic-workflow pattern — so a failing call becomes a null hole and both
// calls share the concurrency limiter. Mirrors `parallel(areas.map(...))`.
const parallelBranchAnalysisWorkflow = workflow({
  meta: { name: "parallelBranchAnalysis", description: "Parallel git analysis", phases: ["Analyze", "Synthesize"] },
  body: async ({ call, parallel, phase }) => {
    phase("Analyze");
    const [branches, commits] = await parallel([
      () => call(gitAnalyzer,
        { command: "git branch -a 2>/dev/null || echo ''", aspect: "branch count and staleness" },
        { label: "branches" }),
      () => call(gitAnalyzer,
        { command: "git log --since='30 days ago' --oneline 2>/dev/null || echo ''", aspect: "commit frequency" },
        { label: "commits" }),
    ]);
    phase("Synthesize");
    return call.json(
      `branches=${JSON.stringify(branches)} commits=${JSON.stringify(commits)}. Classify repo health as "healthy", "needs-attention", or "critical".`,
      s.object({ health: s.enum("healthy", "needs-attention", "critical"), rationale: s.string }),
    );
  },
});
export default parallelBranchAnalysisWorkflow;
```
