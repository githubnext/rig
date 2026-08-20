# 434 - Git Tag Release Aggregator

```rig
import { execSync } from "node:child_process";
import { agent, p, s, defineTool, steering, repair } from "rig";

const fetchTagCommits = defineTool("fetchTagCommits", {
  description: "Fetch the commit count and date range between two adjacent git tags",
  parameters: s.object({ fromTag: s.string, toTag: s.string }),
  handler: async ({ fromTag, toTag }) => {
    const log = execSync(`git log ${fromTag}..${toTag} --oneline --format="%ad" --date=short`, { encoding: "utf8" });
    const lines = log.trim().split("\n").filter(Boolean);
    const dates = lines.filter(l => l.match(/^\d{4}-\d{2}-\d{2}/)).sort();
    const dateRange = dates.length > 0 ? `${dates[0]}..${dates[dates.length - 1]}` : "unknown";
    return { commitCount: lines.length, dateRange };
  },
});

// Agent role: Aggregate git tag release notes by fetching commit stats between adjacent tags.
const gitTagReleaseAggregator = agent({
  name: "git-tag-release-aggregator",
  model: "small",
  maxTurns: 5,
  instructions: p`You are a git tag release aggregator. Here are the tags sorted by version:
${p.bash("git tag -l --sort=-version:refname")}

For each pair of adjacent tags, call fetchTagCommits(olderTag, newerTag). Then return tags array (each with name, commitCount, dateRange), latestTag (the most recent), and totalTags.`,
  output: s.object({
    tags: s.array(s.object({ name: s.string, commitCount: s.int, dateRange: s.string })),
    latestTag: s.string,
    totalTags: s.int,
  }),
  tools: [fetchTagCommits],
  addons: [steering(), repair()],
});

export default gitTagReleaseAggregator;
```
