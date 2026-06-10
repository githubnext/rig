# 46 - Prompt Intent Inspection

```rig
import { agent, p, s } from "rig";
// Agent role: suggest owners for changed files.
const owners = agent({
    model: "mini",
    output: s.object({
        owners: s.array(s.string),
        unmatchedFiles: s.array(s.string)
    }),
    instructions: `Suggest owners for changed files.`,
});

export default owners;
```
