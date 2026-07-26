# 93 - Hotspot File Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: analyze which source files are hot-spots by measuring churn and top contributors.
const hotspotFileAnalyzer = agent({
  model: "small",
  instructions: p`Analyze file churn in this repository. Get recently changed files using ${p.bash("git log --name-only --format='' HEAD~100..HEAD | sort | uniq -c | sort -rn | head -30")} and contributor data using ${p.bash("git shortlog -sn --no-merges HEAD~100..HEAD")}. For each hot-spot file, compute a churnScore 0–100 based on how often it changes, list topContributors, and classify riskLevel as low, medium, or high.`,
  output: s.record(s.object({
    churnScore: s.number,
    topContributors: s.array(s.string),
    riskLevel: s.enum("low", "medium", "high"),
  })),
  maxTurns: 5,
});

export default hotspotFileAnalyzer;
```
