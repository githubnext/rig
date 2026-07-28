# 254 - Git Author Stats

```rig
import { agent, p, s } from "rig";

// Agent role: aggregate git commit statistics per author including commit counts and date ranges
const gitAuthorStats = agent({
  name: "gitAuthorStats",
  model: "small",
  instructions: p`Aggregate git commit statistics per author.

Author commit counts: ${p.bash("git shortlog -sne --all 2>/dev/null | head -40")}

Commit log with author emails and dates: ${p.bash("git log --format='%ae|%ad' --date=short 2>/dev/null | head -200")}

For each unique author email, compute:
- commitCount: total number of commits
- firstCommit: earliest commit date (YYYY-MM-DD)
- lastCommit: most recent commit date (YYYY-MM-DD)

Identify topAuthor with the most commits.
Compute totalCommits across all authors.`,
  output: s.object({
    authors: s.record(
      s.object({
        commitCount: s.int,
        firstCommit: s.string,
        lastCommit: s.string,
      })
    ),
    topAuthor: s.string,
    totalCommits: s.int,
  }),
});

export default gitAuthorStats;
```
