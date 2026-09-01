# 498 - Git Branch Risk Classifier

```rig
import { agent, defineTool, p, s, steering, repair } from "rig";

const classifyBranchRisk = defineTool("classifyBranchRisk", {
  description: "Classify a branch merge risk based on ahead/behind commit counts",
  parameters: s.object({ branch: s.string, ahead: s.int, behind: s.int }),
  handler({ ahead, behind }): "safe" | "caution" | "risky" | "critical" {
    const total = ahead + behind;
    if (total === 0) return "safe" as const;
    if (total <= 5) return "caution" as const;
    if (total <= 20) return "risky" as const;
    return "critical" as const;
  },
});

// Agent role: list local git branches with ahead/behind counts and classify each by merge risk.
const gitBranchRiskClassifier = agent({
  model: "small",
  instructions: p`List branches with ${p.bash("git branch --format='%(refname:short) %(ahead-behind:HEAD)' 2>/dev/null | head -20 || true")}. Use classifyBranchRisk for each branch with its ahead/behind numbers. Return the risk classification for every branch.`,
  output: s.object({
    branches: s.array(s.object({ name: s.string, ahead: s.int, behind: s.int, risk: s.string })),
    riskyCritical: s.array(s.string),
    summary: s.string,
  }),
  tools: [classifyBranchRisk],
  addons: [steering(), repair()],
});

export default gitBranchRiskClassifier;
```
