# 157 - Commit Churn Classifier

```rig
import { agent, p, s, steering } from "rig";

// Agent role: classify files by commit churn frequency and assign a risk level.
const commitChurnClassifier = agent({
  model: "small",
  addons: steering({ message: "Be precise: assign riskLevel based on churnCount: >20=critical, >10=volatile, >5=active, else stable." }),
  instructions: p`Classify repository files by how frequently they are committed (churn).

File churn counts from last 100 commits (count file):
${p.bash("git log --name-only --format='' HEAD~100..HEAD 2>/dev/null | grep -v '^$' | sort | uniq -c | sort -rn | head -30")}

For each file in the output above, parse the churn count and assign a riskLevel:
- critical: churnCount > 20
- volatile: churnCount > 10
- active: churnCount > 5
- stable: churnCount <= 5

Return a record keyed by file path with churnCount (integer) and riskLevel.`,
  output: s.record(
    s.object({
      churnCount: s.int,
      riskLevel: s.enum("stable", "active", "volatile", "critical"),
    })
  ),
});

export default commitChurnClassifier;
```
