# 11 - Release Notes

```rig
import { agent, p, s } from "rig";
// Agent role: triage the pull request and recommend reviewers.
const triage = agent({
    model: "mini",
    output: s.object({
        area: s.enum("runtime", "docs", "tests", "ci", "unknown"),
        risk: s.enum("low", "medium", "high"),
        reviewers: s.array(s.string),
        reason: s.string
    }),
    instructions: `Triage the pull request and recommend reviewers.`,
});

export default triage;
```
