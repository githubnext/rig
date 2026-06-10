# 18 - Patch Writer Output

```rig
import { agent, p, s } from "rig";
// Agent role: plan a minimal, low-risk refactor. Do not edit files.
const refactorPlan = agent({
    model: "mini",
    output: s.object({
        steps: s.array(s.string),
        files: s.array(s.string),
        risks: s.array(s.string)
    }),
    instructions: `Plan a minimal, low-risk refactor. Do not edit files.`,
});

export default refactorPlan;
```
