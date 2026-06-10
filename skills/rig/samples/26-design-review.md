# 26 - Design Review

```rig
import { agent, s } from "rig";
// Agent role: write a concise migration guide.
const migration = agent({
    model: "mini",
    output: s.object({
        title: s.string,
        steps: s.array(s.string),
        examples: s.array(s.object({
            before: s.string,
            after: s.string
        }))
    }),
    instructions: `Write a concise migration guide.`,
});

export default migration;
```
