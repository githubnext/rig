# 73 - Git Branch Pruner

```rig
import { agent, p, s } from "rig";
import { repair } from "rig/addons";

// Agent role: identify git branches that are candidates for pruning based on merge status and last commit date.
const gitBranchPruner = agent({
  model: "small",
  instructions: p`Analyze git branches using ${p.bash("git branch --merged HEAD 2>/dev/null || echo 'no branches'")} and ${p.bash("git for-each-ref --format='%(refname:short) %(committerdate:short)' refs/heads/ 2>/dev/null || echo 'no refs'")}. For each branch determine if it should be pruned (merged and not main/master/develop) or kept. Exclude the current branch from prune candidates.`,
  output: s.object({
    candidates: s.array(s.object({
      branch: s.string,
      lastCommitDate: s.optional(s.string),
      action: s.enum("keep", "prune"),
      reason: s.string,
    })),
    totalBranches: s.int,
    pruneCount: s.int,
  }),
  maxTurns: 6,
  addons: repair(),
});

export default gitBranchPruner;

```
