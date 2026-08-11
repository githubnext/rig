# 410 - Merge Strategy Selector

```rig
import { workflow, agent, p, s } from "rig";

// Agent role: Analyze recent git diff stats to determine changed files and dominant area.
const branchDiffAgent = agent({
  model: "small",
  instructions: p`Git diff stats:
${p.bash("git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat HEAD")}

Classify the changed files and determine the dominant area: src, test, config, docs, or mixed.`,
  output: s.object({
    changedFiles: s.array(s.string),
    totalFiles: s.int,
    dominantArea: s.enum("src", "test", "config", "docs", "mixed"),
  }),
});

// Agent role: Detect conflict files from git status output.
const conflictRiskAgent = agent({
  model: "small",
  instructions: p`Git status:
${p.bash("git status --short")}

Identify any unmerged or conflict-marked files (lines starting with UU, AA, DD, AU, UA, DU, UD). Return conflictCount, conflictFiles, and hasConflicts.`,
  output: s.object({
    conflictCount: s.int,
    conflictFiles: s.array(s.string),
    hasConflicts: s.boolean,
  }),
});

type DiffResult = { changedFiles: string[]; totalFiles: number; dominantArea: "src" | "test" | "config" | "docs" | "mixed" };
type ConflictResult = { conflictCount: number; conflictFiles: string[]; hasConflicts: boolean };

// Workflow role: Combine branch diff and conflict risk to recommend a merge strategy.
const mergeStrategySelector = workflow({
  meta: { name: "mergeSelector", description: "Recommend merge strategy based on diff and conflict analysis", phases: ["Analyze", "Recommend"] },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const diffResult = await call(branchDiffAgent, "diff") as DiffResult;
    const conflictResult = await call(conflictRiskAgent, "conflict") as ConflictResult;
    phase("Recommend");
    return call.json(
      `Branch diff: ${JSON.stringify(diffResult)}\nConflict analysis: ${JSON.stringify(conflictResult)}\n\nChoose the best merge strategy and explain why.`,
      s.object({
        mergeRecommendation: s.enum("fast-forward", "squash", "merge", "rebase"),
        rationale: s.string,
        totalChangedFiles: s.int,
      })
    );
  },
});

export default mergeStrategySelector;
```
