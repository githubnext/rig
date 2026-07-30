import { agent, p, s, defineTool } from "rig";

const parseWorktreePorcelain = defineTool("parseWorktreePorcelain", {
  description: "Parse the output of git worktree list --porcelain into structured entries",
  parameters: s.object({ output: s.string }),
  handler({ output }) {
    const entries: Array<{ path: string; branch?: string; state: string }> = [];
    const blocks = output.trim().split("\n\n");
    for (const block of blocks) {
      const lines = block.split("\n");
      const pathLine = lines.find((l) => l.startsWith("worktree "));
      const branchLine = lines.find((l) => l.startsWith("branch "));
      const isLocked = lines.some((l) => l.startsWith("locked"));
      const isBare = lines.some((l) => l.startsWith("bare"));
      const entry: { path: string; branch?: string; state: string } = {
        path: pathLine ? pathLine.replace("worktree ", "") : "",
        state: isLocked ? "locked" : isBare ? "bare" : "clean",
      };
      if (branchLine) entry.branch = branchLine.replace("branch refs/heads/", "");
      if (entry.path) entries.push(entry);
    }
    return entries;
  },
});

// Agent role: list and classify all git worktrees in the current repository.
const gitWorktreeMapper = agent({
  model: "typecheck",
  instructions: p`List all git worktrees using ${p.bash("git worktree list --porcelain")}. Use the parseWorktreePorcelain tool to parse the output. Determine the state of each worktree (locked, bare, clean, or dirty if there are uncommitted changes). Provide a summary with totalCount and activeCount (non-bare worktrees).`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.string,
      branch: s.optional(s.string),
      state: s.enum("locked", "bare", "clean", "dirty"),
    })),
    summary: s.object({
      totalCount: s.number,
      activeCount: s.number,
    }),
  }),
  tools: [parseWorktreePorcelain],
});

export default gitWorktreeMapper;
