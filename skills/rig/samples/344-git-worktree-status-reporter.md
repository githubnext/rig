# 344 - Git Worktree Status Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyWorktree = defineTool("classifyWorktree", {
  description: "Classify a git worktree entry as clean, dirty, bare, or detached",
  parameters: s.object({ path: s.string, branch: s.string, statusOutput: s.string }),
  handler({ branch, statusOutput }) {
    if (branch === "(bare)") return { status: "bare" as const };
    if (branch.startsWith("(HEAD detached")) return { status: "detached" as const };
    if (statusOutput.trim().length > 0) return { status: "dirty" as const };
    return { status: "clean" as const };
  },
});

// Agent role: report the status of all git worktrees in the repository.
const gitWorktreeStatusReporter = agent({
  model: "small",
  instructions: p`Worktree list: ${p.bash("git worktree list --porcelain")}

Parse each worktree block (separated by blank lines). For each worktree, call classifyWorktree with its path, branch, and an empty statusOutput (use "dirty" heuristic based on porcelain output if available). Return the list of worktrees with their statuses, total count, and whether all are clean.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.path,
      branch: s.string,
      status: s.enum("clean", "dirty", "bare", "detached"),
    })),
    totalWorktrees: s.int,
    allClean: s.boolean,
  }),
  tools: [classifyWorktree],
  addons: [repair()],
  maxTurns: 4,
});

export default gitWorktreeStatusReporter;
```
