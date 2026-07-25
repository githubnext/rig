# 103 - Hotspot File Analyzer 2

```rig
import { agent, p, s } from "rig";
import { steering } from "rig/addons";

// Agent role: identify hot-spot files by measuring commit churn and contributor spread.
const hotspotFileAnalyzer = agent({
  model: "small",
  instructions: p`Find hot-spot files using commit history: ${p.bash("git log --name-only --format='' HEAD~100..HEAD | grep -v '^$' | sort | uniq -c | sort -rn | head -20")}. For each of the top 10 files, get top contributors via ${p.bash("git shortlog -sn --no-merges HEAD~100..HEAD | head -10")}. Compute a churnScore (0-100) based on commit frequency and list topContributors per file.`,
  output: s.record(s.object({
    churnScore: s.number,
    topContributors: s.array(s.string),
  })),
  maxTurns: 5,
  addons: steering({ message: "Every file entry must have a numeric churnScore 0-100 and at least one topContributor." }),
});

export default hotspotFileAnalyzer;
```
