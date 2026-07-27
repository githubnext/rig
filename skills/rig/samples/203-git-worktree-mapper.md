# 203 - Git Worktree Mapper

```rig
import { agent, p, s, defineTool } from "rig";

const parseWorktreePorcelain = defineTool("parseWorktreePorcelain", {
  description: "Parse the porcelain output of git worktree list into structured entries",
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

// Agent role: map all git worktrees and summarize active vs total count.
const gitWorktreeMapperV2 = agent({
  model: "small",
  instructions: p`Get all git worktrees: ${p.bash("git worktree list --porcelain 2>/dev/null || echo ''")}. Use the parseWorktreePorcelain tool to parse the output into structured entries. For each worktree check if there are uncommitted changes (set state to dirty). Count all worktrees for totalCount and non-bare ones for activeCount.`,
  output: s.object({
    worktrees: s.array(s.object({
      path: s.string,
      branch: s.optional(s.string),
      state: s.enum("locked", "bare", "clean", "dirty"),
    })),
    summary: s.object({
      totalCount: s.int,
      activeCount: s.int,
    }),
  }),
  tools: [parseWorktreePorcelain],
});

export default gitWorktreeMapperV2;
```
