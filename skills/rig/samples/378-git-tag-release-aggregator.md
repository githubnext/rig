# 378 - Git Tag Release Aggregator

```rig
import { agent, defineTool, p, s, steering } from "rig";

const fetchTagCommits = defineTool("fetchTagCommits", {
  description: "Get commit count and date range between two git tags or refs",
  parameters: s.object({
    fromTag: s.string("earlier tag or ref"),
    toTag: s.string("later tag or ref (use HEAD for latest)"),
  }),
  handler({ fromTag, toTag }) {
    const { execSync } = require("node:child_process");
    try {
      const log = execSync(
        `git log ${fromTag}..${toTag} --oneline --format="%H %ai" 2>/dev/null | head -100`,
        { encoding: "utf8" }
      ).trim();
      const lines = log ? log.split("\n").filter(Boolean) : [];
      const dates = lines.map((l: string) => l.split(" ")[1]).filter(Boolean);
      return JSON.stringify({
        commitCount: lines.length,
        start: dates[dates.length - 1] ?? "",
        end: dates[0] ?? "",
      });
    } catch {
      return JSON.stringify({ commitCount: 0, start: "", end: "" });
    }
  },
});

// Agent role: aggregate release metadata for each git tag in the repository.
const gitTagReleaseAggregator = agent({
  model: "small",
  maxTurns: 5,
  instructions: p`Aggregate release information for git tags.

Available tags (newest first):
${p.bash("git tag -l --sort=-version:refname 2>/dev/null | head -20 || echo 'no tags found'")}

For each pair of adjacent tags, call fetchTagCommits to get commit count and date range between them. For the most recent tag, fetch commits from it to HEAD.

Return the output schema with tags array, latestTag, and totalTags.`,
  output: s.object({
    tags: s.array(s.object({
      name: s.string,
      commitCount: s.int,
      dateRange: s.object({
        start: s.string,
        end: s.string,
      }),
    })),
    latestTag: s.string,
    totalTags: s.int,
  }),
  tools: [fetchTagCommits],
  addons: [steering()],
});

export default gitTagReleaseAggregator;
```
