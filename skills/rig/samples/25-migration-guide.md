# 25 - Migration Guide

```rig
import { agent, s } from "rig";
// Agent role: rewrite the error to be actionable and precise.
const improve = agent({
    model: "mini",
    output: s.object({
        message: s.string,
        explanation: s.string
    }),
    instructions: `Rewrite the error to be actionable and precise.`,
});

export default improve;
```
