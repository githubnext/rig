# 130 - Git Hotspot Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: analyze which files are hot-spots by measuring commit churn and top contributors.
const gitHotspotAnalyzer = agent({
  model: "small",
  instructions: p`Analyze file churn in this repository. List all tracked files: ${p.bash("git ls-files --exclude-standard | head -100")}. Get commit counts per file: ${p.bash("git log --follow --name-only --format='' -- . | sort | uniq -c | sort -rn | head -40")}. Get top contributors per file via: ${p.bash("git shortlog -sn --no-merges HEAD~50..HEAD 2>/dev/null || git shortlog -sn --no-merges | head -20")}. For each hot-spot file compute a churnScore 0–100 (based on commit frequency relative to max) and list topContributors.`,
  output: s.record(s.object({
    churnScore: s.number,
    topContributors: s.array(s.string),
  })),
  maxTurns: 5,
});

export default gitHotspotAnalyzer;
```
