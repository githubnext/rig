# 533 - Repair Addon Strict Output

```rig
import { agent, p, repair, s } from "rig";

// Agent role: assess working tree status and return a risk verdict.
const assessStatus = agent({
  model: "small",
  maxTurns: 6,
  instructions: p`Review ${p.bash("git status --short")} and return a concise summary,
    an overall risk level, and concrete action items.`,
  output: s.object({
    summary: s.string,
    riskLevel: s.enum("low", "medium", "high"),
    actionItems: s.array(s.string),
  }),
  addons: repair(),
});

export default assessStatus;
```
