# 113 - Git Hotspot Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: identify hot-spot files by git churn and top contributors.
const gitHotspotAnalyzer = agent({
  model: "mini",
  input: s.object({
    topN: s.int,
  }),
  instructions: p`Analyze git history to find the most frequently changed files.

Changed files from git log:
${p.bash("git log --follow --name-only --format='' -- . | sort | uniq -c | sort -rn | head -20")}

For the top files identified, get contributor info:
${p.bash("git shortlog -sn --all -- . 2>/dev/null | head -10")}

Select the top \${input.topN} files by churn score. For each file compute a churnScore
(number of commits) and list topContributors. Return only the declared output as a record
keyed by file path.`,
  output: s.record(
    s.object({
      churnScore: s.number,
      topContributors: s.array(s.string),
    })
  ),
});

export default gitHotspotAnalyzer;
```
