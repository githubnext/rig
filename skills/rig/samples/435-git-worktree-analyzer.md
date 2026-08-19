# 435 - Git Worktree Analyzer

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const classifyWorktree = defineTool("classifyWorktree", {
  description: "Classify a git worktree entry into type and status.",
  parameters: s.object({ path: s.string, isBare: s.boolean, branch: s.optional(s.string), isDetached: s.boolean }),
  handler({ isBare, branch, isDetached }) {
    const type = isBare ? ("bare" as const) : branch === "main" || branch === "master" ? ("main" as const) : ("linked" as const);
    const status = isDetached ? ("detached" as const) : ("clean" as const);
    return { type, status };
  },
});

// Agent role: List and analyze git worktrees, classifying each by type and status.
const gitWorktreeAnalyzer = agent({
  model: "small",
  instructions: p`List all git worktrees: ${p.bash("git worktree list --porcelain")}. Use classifyWorktree for each worktree. Return the full list with types and statuses.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.string,
      type: s.enum("main", "linked", "bare"),
      status: s.enum("clean", "dirty", "detached"),
      branch: s.optional(s.string),
    })),
    totalWorktrees: s.int,
    hasLinked: s.boolean,
    dirtyCount: s.int,
  }),
  tools: [classifyWorktree],
  addons: [steering(), repair()],
});

export default gitWorktreeAnalyzer;
```
