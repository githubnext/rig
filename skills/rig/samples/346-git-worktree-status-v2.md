# 346 - Git Worktree Status V2

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Report git worktree status by listing worktrees and classifying each as clean, dirty, bare, or detached.
const gitWorktreeStatusReporter = agent({
  model: "small",
  instructions: p`You are a git worktree status reporter.

Worktree list:
${p.bash("git worktree list --porcelain")}

Current worktree status:
${p.bash("git status --short")}

${defineTool("classifyWorktree", {
  description: "Classify a git worktree as clean, dirty, bare, or detached",
  parameters: s.object({
    path: s.string,
    branch: s.optional(s.string),
    isDetached: s.boolean,
    isBare: s.boolean,
  }),
  handler: (args) => {
    const status = args.isBare ? "bare" as const
      : args.isDetached ? "detached" as const
      : "clean" as const;
    return { status };
  },
})}

Classify each worktree, determine if all are clean, and return the structured report.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.string,
      branch: s.optional(s.string),
      status: s.enum("clean", "dirty", "bare", "detached"),
    })),
    totalWorktrees: s.int,
    allClean: s.boolean,
  }),
  addons: [repair()],
});

export default gitWorktreeStatusReporter;
```
