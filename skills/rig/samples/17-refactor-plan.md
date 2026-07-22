# 17 - Refactor Plan

```rig
import { agent, p, s } from "rig";
// Agent role: find documentation gaps against the source API.
const docsGap = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        missing: s.array(s.string),
        stale: s.array(s.string),
        quickFixes: s.array(s.string)
    }),
    instructions: `Find documentation gaps against the source API.`,
});

export default docsGap;
```
