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
    instructions: `Rewrite the following error to be actionable and precise:\n\nTypeError: Cannot read properties of undefined (reading 'map') at Array.forEach (<anonymous>)\n    at processItems (src/processor.ts:23:18)`,
});

export default improve;
```
