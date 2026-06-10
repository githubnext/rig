# 41 - Parse Coverage

```rig
import { agent, p, s } from "rig";
// Agent role: parse coverage by file path.
const coverage = agent({
    model: "mini",
    output: s.object({
        files: s.record(s.object({
            lines: s.number,
            branches: s.number,
            notes: s.optional(s.string)
        }))
    }),
    instructions: `Parse coverage by file path.`,
});

export default coverage;
```
