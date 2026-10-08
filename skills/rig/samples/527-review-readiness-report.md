# 527 - Review Readiness Report

```rig
import { agent, p, s } from "rig";

// Agent role: assess review readiness from recent diff stats and contributing guide presence.
const reviewReadiness = agent({
  model: "small",
  instructions: p`Run ${p.bash("git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat HEAD~1..HEAD 2>/dev/null || echo 'no history available'")} to see recent change volume, and read ${p.readOptional("CONTRIBUTING.md", "no contributing guide found")} to check for a contributing guide. Report the number of files changed, the total number of lines changed (insertions plus deletions), whether a contributing guide exists, and a short list of actionable recommendations to improve review readiness (e.g. add tests, split large diffs, add a contributing guide).`,
  output: s.object({
    filesChanged: s.int,
    linesChanged: s.int,
    hasContributingGuide: s.boolean,
    recommendations: s.array(s.string),
  }),
});

export default reviewReadiness;
```
