# 13 - Test Plan

```rig
import { agent, p, s } from "rig";
// Agent role: review dependency security posture from the provided outputs.
const securityReview = agent({
    model: "mini",
    output: s.object({
        status: s.enum("clean", "needs-action", "unknown"),
        findings: s.array(s.object({
            package: s.string,
            severity: s.string,
            action: s.string
        }))
    }),
    instructions: `Review dependency security posture from the provided outputs.`,
});

export default securityReview;
```
