# 431 - Git Worktree Analyzer

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const classifyWorktree = defineTool("classifyWorktree", {
  description: "Classify a single worktree entry from git worktree list --porcelain output",
  parameters: s.object({ worktreeText: s.string }),
  handler: async ({ worktreeText }) => {
    const isMain = worktreeText.includes("branch refs/heads/") && !worktreeText.includes("prunable");
    const isBare = worktreeText.includes("bare");
    const isDirty = worktreeText.includes("dirty");
    const isDetached = worktreeText.includes("detached");
    const type = isBare ? "bare" : isMain ? "main" : "linked";
    const status = isDirty ? "dirty" : isDetached ? "detached" : "clean";
    return { type, status } as { type: "main" | "linked" | "bare"; status: "clean" | "dirty" | "detached" };
  },
});

// Agent role: Analyze git worktrees, classify each by type and status, and report summary stats.
const gitWorktreeAnalyzer = agent({
  name: "git-worktree-analyzer",
  model: "small",
  maxTurns: 5,
  instructions: p`You are a git worktree analyzer. Here is the output of git worktree list:
${p.bash("git worktree list --porcelain")}

For each worktree entry (separated by blank lines), call classifyWorktree with the full entry text.
Then return the structured output with all worktrees, totalWorktrees, hasLinked, and dirtyCount.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.path,
      type: s.enum("main", "linked", "bare"),
      status: s.enum("clean", "dirty", "detached"),
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
