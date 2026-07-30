import { agent, p, s, defineTool, steering } from "rig";

const classifyRisk = defineTool("classifyRisk", {
  description: "Classify a file's churn risk level based on how many times it has changed.",
  parameters: s.object({ churnCount: s.int }),
  handler({ churnCount }) {
    if (churnCount <= 3) return "stable" as const;
    if (churnCount <= 10) return "active" as const;
    if (churnCount <= 25) return "volatile" as const;
    return "critical" as const;
  },
});

// Agent role: analyze git commit history to classify file churn risk.
const commitChurnClassifier = agent({
  model: "typecheck",
  addons: steering(),
  instructions: p`Analyze file churn from git commit history.

File change frequency (count + filename):
${p.bash("git log --name-only --format='' | grep -v '^$' | sort | uniq -c | sort -rn | head -30")}

For each line, parse the count and file path.
Call classifyRisk with the churnCount to get the riskLevel.
Build a record keyed by file path with churnCount and riskLevel.
Include only files that appear in the output above.`,
  tools: [classifyRisk],
  output: s.record(
    s.object({
      churnCount: s.int,
      riskLevel: s.enum("stable", "active", "volatile", "critical"),
    })
  ),
});

export default commitChurnClassifier;
