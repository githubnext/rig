# 264 - Commit Churn Classifier

```rig
import { agent, p, s, steering } from "rig";

// Agent role: classify repository files by commit churn frequency and assign a risk level.
const commitChurnClassifier = agent({
  model: "small",
  addons: steering({ message: "Assign riskLevel based on churnCount: >20=critical, >10=volatile, >5=active, else stable. Only include files from the churn output." }),
  instructions: p`Classify repository files by commit churn (how frequently they change).

File churn counts from git history:
${p.bash("git log --name-only --format='' 2>/dev/null | grep -v '^$' | sort | uniq -c | sort -rn | head -30")}

For each file in the output, parse the churn count and assign a riskLevel:
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
