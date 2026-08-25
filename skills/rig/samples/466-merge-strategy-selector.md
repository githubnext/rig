# 466 - Merge Strategy Selector

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: analyze git diff --stat to determine which area of the codebase changed most.
const branchDiffAgent = agent({
  name: "branchDiffAgent",
  model: "small",
  instructions: p`Analyze the git diff statistics for the current branch vs main.
${p.bash("git diff --stat origin/main...HEAD 2>/dev/null || git diff --stat HEAD~1...HEAD 2>/dev/null || echo 'no diff available'")}
Determine which area of the codebase was changed most (src/test/config/docs/mixed).`,
  output: s.object({
    changedFiles: s.int,
    insertions: s.int,
    deletions: s.int,
    dominantArea: s.enum("src", "test", "config", "docs", "mixed"),
  }),
});

// Agent role: assess merge conflict risk from git status.
const conflictRiskAgent = agent({
  name: "conflictRiskAgent",
  model: "small",
  instructions: p`Check git working tree status for conflicts.
${p.bash("git status --short 2>/dev/null | head -30")}
Count conflict markers (lines starting with UU, AA, DD) and report conflict risk.`,
  output: s.object({
    conflictCount: s.int,
    hasConflicts: s.boolean,
  }),
});

// Workflow role: analyze branch diff and conflict risk, then recommend a merge strategy.
export default workflow({
  meta: { name: "merge-strategy-selector", description: "Select optimal merge strategy based on diff and conflict analysis." },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const [diffResult, conflictResult] = await Promise.all([
      call(branchDiffAgent, "analyze diff"),
      call(conflictRiskAgent, "check conflicts"),
    ]);
    phase("Recommend");
    return call.json(
      `dominantArea=${diffResult?.dominantArea} changedFiles=${diffResult?.changedFiles} hasConflicts=${conflictResult?.hasConflicts} conflictCount=${conflictResult?.conflictCount}. Choose mergeRecommendation: fast-forward (few files, no conflicts, src-only), squash (many small commits, clean), merge (mixed areas), rebase (linear history preferred, no conflicts).`,
      s.object({
        mergeRecommendation: s.enum("fast-forward", "squash", "merge", "rebase"),
        rationale: s.string,
      }),
    );
  },
});
```
