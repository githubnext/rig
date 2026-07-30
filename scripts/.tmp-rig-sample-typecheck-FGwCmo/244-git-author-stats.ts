import { agent, p, s } from "rig";

// Agent role: aggregate git author statistics including commit counts and first/last commit dates.
const gitAuthorStats = agent({
  model: "typecheck",
  instructions: p`Aggregate git commit statistics by author.

Commit counts per author: ${p.bash("git shortlog -sne --all 2>/dev/null || echo ''")}
Per-commit author and date: ${p.bash("git log --format='%ae|%ai' --all 2>/dev/null | head -500")}

Steps:
1. Parse the shortlog output to extract each author email and commit count.
2. From the per-commit log, compute firstCommit (earliest date) and lastCommit (latest date) per author email.
3. Build the authors record keyed by email with commitCount, firstCommit, lastCommit.
4. Set topAuthor to the email with the highest commitCount.
5. Set totalCommits to the sum of all commitCounts.`,
  output: s.object({
    authors: s.record(s.object({
      commitCount: s.number,
      firstCommit: s.string,
      lastCommit: s.string,
    })),
    topAuthor: s.string,
    totalCommits: s.number,
  }),
});

export default gitAuthorStats;
