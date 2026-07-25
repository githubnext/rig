# 137 - Git Author Stats

```rig
import { agent, p, s } from "rig";

// Agent role: aggregate commit statistics per git author, including first/last commit dates and total counts.
const gitAuthorStats = agent({
  model: "small",
  instructions: p`Aggregate git commit statistics per author.

Commit counts by author: ${p.bash("git shortlog -sne --all 2>/dev/null | head -40")}

Commit log with dates: ${p.bash("git log --format='%ae|%ad' --date=short 2>/dev/null | head -200")}

For each author email, compute commitCount, firstCommit date, and lastCommit date. Identify the topAuthor with the most commits. Compute totalCommits across all authors.`,
  output: s.object({
    authors: s.record(s.object({
      commitCount: s.int,
      firstCommit: s.string,
      lastCommit: s.string,
    })),
    topAuthor: s.string,
    totalCommits: s.int,
  }),
});

export default gitAuthorStats;
```
