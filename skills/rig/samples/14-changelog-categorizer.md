# 14 - Changelog Categorizer

```rig
import { agent, p, s } from "rig";
// Agent role: create a focused validation plan for the current changes.
const planner = agent({
    model: "mini",
    output: s.object({
        commands: s.array(s.string),
        manualChecks: s.array(s.string),
        rationale: s.string
    }),
    instructions: `Create a focused validation plan for the current changes.`,
});

export default planner;
```
