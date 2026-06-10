# 06 - List Source Files

```rig
import { agent, p, s } from "rig";
// Agent role: confirm whether the write intent succeeded.
const writer = agent({
    model: "mini",
    output: s.object({
        written: s.boolean,
        summary: s.string
    }),
    instructions: `
    Confirm whether the write intent succeeded.
  `,
});

export default writer;
```
