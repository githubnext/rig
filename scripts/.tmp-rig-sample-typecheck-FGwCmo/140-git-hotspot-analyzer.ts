import { agent, p, s, defineTool, steering } from "rig";

const scoreFile = defineTool("scoreFile", {
  description: "Compute a churn score from commit count for a file.",
  parameters: s.object({ filename: s.string, commitCount: s.int }),
  handler({ commitCount }) {
    const score = Math.log1p(commitCount) * 10;
    return { churnScore: Math.round(score * 100) / 100 };
  },
});

// Agent role: Analyze git history to identify hot-spot files by churn frequency.
const gitHotspotAnalyzer = agent({
  model: "typecheck",
  instructions: p`Analyze the git log to find frequently-changed files.

Use the git history:
${p.bash("git log --name-only --format= | sort | uniq -c | sort -rn | head -30")}

For each file in the top results, get contributor info:
${p.bash("git shortlog -sn --no-merges -- . | head -10")}

Use the scoreFile tool to compute a churnScore for each file.
Return s.record output keyed by file path with churnScore, commitCount, and topContributors.`,
  tools: [scoreFile],
  addons: steering({ message: "Ensure all top files appear in the output keyed by their path." }),
  output: s.record(
    s.object({
      churnScore: s.number,
      commitCount: s.int,
      topContributors: s.array(s.string),
    }),
  ),
});

export default gitHotspotAnalyzer;
