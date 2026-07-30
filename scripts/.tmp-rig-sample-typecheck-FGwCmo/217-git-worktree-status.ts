import { agent, p, s, defineTool, repair } from "rig";

const classifyWorktree = defineTool("classifyWorktree", {
  description: "Classify a git worktree's status based on its path, branch, and state flags",
  parameters: s.object({
    path: s.string,
    branch: s.optional(s.string),
    isBare: s.boolean,
    isDetached: s.boolean,
  }),
  handler({ branch, isBare, isDetached }) {
    if (isBare) return "bare";
    if (isDetached) return "detached";
    if (!branch) return "detached";
    return "clean";
  },
});

// Agent role: inventory git worktrees and report their cleanliness status.
const gitWorktreeStatus = agent({
  model: "typecheck",
  instructions: p`List all git worktrees: ${p.bash("git worktree list --porcelain 2>/dev/null || echo 'worktree .\nHEAD unknown\nbranch refs/heads/main'")}. Also check working tree status: ${p.bash("git status --short 2>/dev/null | head -20")}. Use the classifyWorktree tool for each worktree entry. If the current worktree has modified files, override its status to dirty. Set isMain: true for the first (primary) worktree. Set allClean to true only when every worktree has status clean.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.path,
      branch: s.optional(s.string),
      status: s.enum("clean", "dirty", "bare", "detached"),
      isMain: s.boolean,
    })),
    totalWorktrees: s.int,
    allClean: s.boolean,
  }),
  tools: [classifyWorktree],
  maxTurns: 4,
  addons: repair(),
});

export default gitWorktreeStatus;
