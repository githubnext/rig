# 439 - Git Commit Risk Classifier

```rig
import { agent, p, s, defineTool } from "rig";

const classifyCommitRisk = defineTool("classifyCommitRisk", {
  description: "Classify the risk level of a git commit based on its change stats and message.",
  parameters: s.object({
    sha: s.string,
    message: s.string,
    filesChanged: s.int,
    insertions: s.int,
    deletions: s.int,
  }),
  handler({ message, filesChanged, insertions, deletions }: { sha: string; message: string; filesChanged: number; insertions: number; deletions: number }) {
    if (/BREAKING.CHANGE/i.test(message)) {
      return { risk: "critical" as const, reasoning: "Commit message contains BREAKING CHANGE" };
    }
    if (filesChanged > 20 || insertions > 500) {
      return { risk: "high" as const, reasoning: `Large change: ${filesChanged} files, ${insertions} insertions` };
    }
    if (filesChanged > 5 || insertions > 100) {
      return { risk: "medium" as const, reasoning: `Moderate change: ${filesChanged} files, ${insertions} insertions` };
    }
    return { risk: "low" as const, reasoning: `Small change: ${filesChanged} files, ${insertions} insertions, ${deletions} deletions` };
  },
});

// Agent role: classify risk level of recent git commits based on change statistics.
const gitCommitRiskClassifier = agent({
  model: "small",
  instructions: p`Classify the risk level of recent git commits.

Recent commit stats:
${p.bash("git log --stat -10 --format='COMMIT:%H %s' 2>/dev/null")}

Parse the output to extract each commit's sha, message, filesChanged, insertions, and deletions.
Call classifyCommitRisk for each commit.
Build the commits array with all fields.
Compute summary.total (total commits), and summary.byRisk counting each risk level.`,
  tools: [classifyCommitRisk],
  output: s.object({
    commits: s.array(
      s.object({
        sha: s.string,
        message: s.string,
        filesChanged: s.int,
        insertions: s.int,
        deletions: s.int,
        risk: s.enum("low", "medium", "high", "critical"),
        reasoning: s.string,
      })
    ),
    summary: s.object({
      total: s.int,
      byRisk: s.object({ low: s.int, medium: s.int, high: s.int, critical: s.int }),
    }),
  }),
});

export default gitCommitRiskClassifier;
```
