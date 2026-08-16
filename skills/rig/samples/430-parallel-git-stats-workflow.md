# 430 - Parallel Git Stats Workflow

```rig
import { workflow, agent, p, s } from "rig";

// Agent role: count commits per author from git log.
const commitStatsAgent = agent({
  model: "small",
  output: s.object({
    authors: s.record(s.int),
    totalCommits: s.int,
  }),
  instructions: p`Count commits per author.

Git commit author counts:
${p.bash("git log --format='%aN' | sort | uniq -c | sort -rn | head -20")}

Parse each line (format: "  COUNT AUTHOR"). Build authors record keyed by author name.
totalCommits = sum of all counts.`,
});

// Agent role: count repository files by extension.
const fileStatsAgent = agent({
  model: "small",
  output: s.object({
    extensions: s.record(s.int),
    totalFiles: s.int,
  }),
  instructions: p`Count repository files by extension.

File extension counts:
${p.bash("git ls-files | grep '\\.' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20")}

Parse each line (format: "  COUNT EXT"). Build extensions record keyed by extension.
totalFiles = sum of all counts.`,
});

// Workflow role: run commit stats and file stats in parallel, then combine results.
const parallelGitStatsWorkflow = workflow({
  meta: { name: "parallel-git-stats", description: "Run commit and file stats in parallel." },
  body: async ({ call }) => {
    const [authorStats, fileStats] = await Promise.all([
      call(commitStatsAgent, "count commits by author"),
      call(fileStatsAgent, "count files by extension"),
    ]);

    const topContributor = authorStats
      ? Object.entries(authorStats.authors).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0]
      : undefined;
    const topExtension = fileStats
      ? Object.entries(fileStats.extensions).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0]
      : undefined;

    const health = (!authorStats || authorStats.totalCommits === 0)
      ? "empty"
      : authorStats.totalCommits < 10
        ? "sparse"
        : "healthy";

    return call.json(
      `Combine these git repository stats into the final output.
authorStats: ${JSON.stringify(authorStats)}
fileStats: ${JSON.stringify(fileStats)}
topContributor: ${topContributor ?? ""}
topExtension: ${topExtension ?? ""}
overallHealth: ${health}`,
      s.object({
        authorStats: s.record(s.int),
        fileStats: s.record(s.int),
        topContributor: s.optional(s.string),
        topExtension: s.optional(s.string),
        overallHealth: s.enum("healthy", "sparse", "empty"),
      })
    );
  },
});

export default parallelGitStatsWorkflow;
```
