# 417 - Git Stale Branch Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { execSync } from "node:child_process";

const getBranchAge = defineTool("getBranchAge", {
  description: "Get the age of a git branch by looking at its last commit date",
  parameters: s.object({ branchName: s.string }),
  handler: ({ branchName }: { branchName: string }) => {
    let lastCommit: string;
    try {
      lastCommit = execSync(`git log -1 --format=%ci "${branchName}" 2>/dev/null`, { encoding: "utf8" }).trim();
    } catch {
      lastCommit = "";
    }
    if (!lastCommit) {
      return { lastCommit: "unknown", ageDays: -1, ageClass: "ancient" as const };
    }
    const commitDate = new Date(lastCommit);
    const ageDays = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
    let ageClass: "fresh" | "recent" | "stale" | "ancient";
    if (ageDays <= 7) ageClass = "fresh";
    else if (ageDays <= 30) ageClass = "recent";
    else if (ageDays <= 180) ageClass = "stale";
    else ageClass = "ancient";
    return { lastCommit, ageDays, ageClass };
  },
});

// Agent role: Report the age and staleness classification of each remote git branch.
const gitStaleBranchReporter = agent({
  model: "small",
  instructions: p`Report the age of each remote git branch.
Remote branches: ${p.bash("git branch -r")}
Use getBranchAge on each branch name (strip leading whitespace and 'origin/' prefix if needed, but pass the full ref).
Return:
- branches: record mapping branch name to { lastCommit, ageDays, ageClass }
- staleCount: number of branches with ageClass "stale"
- ancientCount: number of branches with ageClass "ancient"
- totalBranches: total count`,
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
  addons: [repair()],
});

export default gitStaleBranchReporter;
```
