# 379 - Git Worktree Analyzer

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyWorktree = defineTool("classifyWorktree", {
  description: "Classify a git worktree entry by type and status.",
  parameters: { path: s.string, branch: s.string, commit: s.string, bare: s.boolean, detached: s.boolean },
  handler: ({ path, branch, commit, bare, detached }: { path: string; branch: string; commit: string; bare: boolean; detached: boolean }) => {
    const type: "main" | "linked" | "bare" = bare ? "bare" : path === process.cwd() ? "main" : "linked";
    const status: "clean" | "dirty" | "detached" = detached ? "detached" : "clean";
    return { path, branch: branch || undefined, commit, type, status } as const;
  },
});

// Agent role: analyze git worktrees and classify each by type and status.
const gitWorktreeAnalyzer = agent({
  model: "small",
  instructions: p`Analyze all git worktrees in this repository.

Worktree listing:
${p.bash("git worktree list --porcelain 2>/dev/null || echo ''")}

Steps:
1. Parse the porcelain output into worktree blocks (each block separated by blank lines).
2. From each block extract: worktree path (first field), HEAD commit, branch (refs/heads/NAME or detached), and bare/detached flags.
3. Call classifyWorktree for each block to get type and status.
4. Build worktrees array.
5. totalWorktrees = worktrees.length.
6. hasLinked = any worktree with type "linked".
7. dirtyCount = count of worktrees with status "dirty".`,
  output: s.object({
    worktrees: s.array(
      s.object({
        path: s.string,
        branch: s.optional(s.string),
        commit: s.string,
        type: s.enum("main", "linked", "bare"),
        status: s.enum("clean", "dirty", "detached"),
      })
    ),
    totalWorktrees: s.int,
    hasLinked: s.boolean,
    dirtyCount: s.int,
  }),
  tools: [classifyWorktree],
  addons: [steering()],
});

export default gitWorktreeAnalyzer;
```
