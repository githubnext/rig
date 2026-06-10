# 10 - Triage Pr

```rig
import { agent, s } from "rig";
// Agent role: classify the GitHub issue and suggest labels.
const classifyIssue = agent({
    model: "mini",
    output: s.object({
        kind: s.enum("bug", "feature", "question", "chore"),
        priority: s.enum("p0", "p1", "p2", "p3"),
        rationale: s.string,
        labels: s.array(s.string)
    }),
    instructions: `Classify the GitHub issue and suggest labels.`,
});

export default classifyIssue;
```
