import { agent, p, s, defineTool, steering, repair } from "rig";

const classifyRisk = defineTool("classifyRisk", {
  description: "Classify churn risk level based on commit count",
  parameters: s.object({ churnCount: s.int }),
  handler: ({ churnCount }) => {
    if (churnCount <= 2) return "stable" as const;
    if (churnCount <= 5) return "active" as const;
    if (churnCount <= 10) return "volatile" as const;
    return "critical" as const;
  },
});

// Agent role: analyze git commit history to classify file churn and risk levels
const commitChurnClassifier = agent({
  model: "typecheck",
  instructions: p`Analyze commit history from ${p.bash("git log --name-only --format='' | grep -v '^$' | sort | uniq -c | sort -rn | head -30")} and classify each file's churn risk using the classifyRisk tool. Return a record keyed by file path.`,
  output: s.record(s.object({
    churnCount: s.int,
    riskLevel: s.enum("stable", "active", "volatile", "critical"),
  })),
  tools: [classifyRisk],
  addons: [steering(), repair()],
});

export default commitChurnClassifier;
