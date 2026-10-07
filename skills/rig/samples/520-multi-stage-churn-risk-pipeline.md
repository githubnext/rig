# 520 - Multi Stage Churn Risk Pipeline

```rig
import { agent, p, s } from "rig";

// Agent role: gather recent file churn from git history, compute per-file change
// counts, classify each file's risk, and return a risk-sorted report.
const churnRiskAnalyzer = agent({
  name: "churn-risk-analyzer",
  model: "small",
  instructions: p`You are analyzing recent repository churn to flag risky files.

Step 1: Review the recently changed file list below, produced by
"git log --since=30.days --name-only --pretty=format:". Each non-empty line
is a file path that changed in one commit; the same path may repeat across
multiple commits.

${p.bash("git log --since=30.days --name-only --pretty=format:")}

Step 2: For each distinct file path, compute its churn count: the number of
times that path appears (non-empty lines) in the list above. Ignore blank
lines.

Step 3: Classify each file's risk based on its churn count using these
thresholds:
- "low": churn is 1-2
- "medium": churn is 3-5
- "high": churn is 6 or more

Return only the declared output: one entry per distinct file path with its
path, churn count, and risk classification, sorted by risk descending
(high first, then medium, then low).`,
  output: s.array(
    s.object({
      path: s.path,
      churn: s.number,
      risk: s.enum("low", "medium", "high"),
    }),
  ),
});

export default churnRiskAnalyzer;
```
