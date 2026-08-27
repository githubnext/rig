# 472 - Merge Strategy Selector

```rig
import { agent, p, s } from "rig";

// Agent role: analyze git diff --stat to determine the dominant changed area.
const branchDiffAgent = agent({
  model: "small",
  instructions: p`Analyze the output of ${p.bash("git diff --stat HEAD~1 2>/dev/null || git diff --stat HEAD 2>/dev/null || echo 'no diff'")}. Determine the dominant area of changes: src (source code), test (test files), config (config files), docs (documentation), or mixed (multiple areas equally).`,
  output: s.object({
    dominantArea: s.enum("src", "test", "config", "docs", "mixed"),
    changedFiles: s.int,
  }),
});

// Agent role: check for conflicts in the working tree.
const conflictRiskAgent = agent({
  model: "small",
  instructions: p`Analyze ${p.bash("git status --short 2>/dev/null || echo ''")} and count lines containing conflict markers (<<<<<<, >>>>>>). Return conflictCount and hasConflicts.`,
  output: s.object({
    conflictCount: s.int,
    hasConflicts: s.boolean,
  }),
});

// Agent role: recommend a merge strategy based on diff area and conflict risk.
const mergeSelectorCoordinator = agent({
  model: "small",
  agents: { branchDiffAgent, conflictRiskAgent },
  instructions: "Call branchDiffAgent first to get the dominant area, then call conflictRiskAgent to assess conflict risk. Based on results, choose mergeRecommendation: fast-forward (no conflicts, few files), squash (many small changes, no conflicts), merge (mixed areas or some conflicts), rebase (single area, no conflicts, clean history). Return all combined fields plus a one-sentence rationale.",
  output: s.object({
    mergeRecommendation: s.enum("fast-forward", "squash", "merge", "rebase"),
    dominantArea: s.enum("src", "test", "config", "docs", "mixed"),
    conflictCount: s.int,
    hasConflicts: s.boolean,
    rationale: s.string,
  }),
});

export default mergeSelectorCoordinator;
```
