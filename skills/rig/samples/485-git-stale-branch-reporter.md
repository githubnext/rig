# 485 - Git Stale Branch Reporter

```rig
import { agent, defineTool, p, repair, s } from "rig";

const getBranchAge = defineTool("getBranchAge", {
  description: "Get the age in days and age class for a git branch.",
  parameters: s.object({ branch: s.string }),
  handler: async ({ branch }) => {
    const { execSync } = await import("node:child_process");
    let lastCommit = "";
    try {
      lastCommit = execSync(`git log --format=%ci -1 "${branch.trim()}" 2>/dev/null`, { encoding: "utf-8" }).trim();
    } catch {
      return { lastCommit: "unknown", ageDays: 9999, ageClass: "ancient" as const };
    }
    if (!lastCommit) return { lastCommit: "unknown", ageDays: 9999, ageClass: "ancient" as const };
    const ageDays = Math.floor((Date.now() - new Date(lastCommit).getTime()) / 86400000);
    const ageClass =
      ageDays < 7 ? "fresh" :
      ageDays < 30 ? "recent" :
      ageDays < 180 ? "stale" : "ancient";
    return { lastCommit, ageDays, ageClass } as { lastCommit: string; ageDays: number; ageClass: "fresh" | "recent" | "stale" | "ancient" };
  },
});

// Agent role: report age class of all remote git branches.
const gitStaleBranchReporter = agent({
  model: "small",
  instructions: p`List remote branches: ${p.bash("git branch -r 2>/dev/null || echo ''")}. For each branch name, call getBranchAge. Return branches as a record keyed by branch name with lastCommit, ageDays, ageClass. Include staleCount (ageClass=stale), ancientCount (ageClass=ancient), and totalBranches.`,
  output: s.object({
    branches: s.record(s.object({
      lastCommit: s.string,
      ageDays: s.int,
      ageClass: s.enum("fresh", "recent", "stale", "ancient"),
    })),
    staleCount: s.int,
    ancientCount: s.int,
    totalBranches: s.int,
  }),
  tools: [getBranchAge],
  maxTurns: 8,
  addons: [repair()],
});

export default gitStaleBranchReporter;
```
