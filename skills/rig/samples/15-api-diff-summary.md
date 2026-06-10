# 15 - Api Diff Summary

```rig
import { agent, s } from "rig";
// Agent role: convert the change description to Keep a Changelog style.
const categorize = agent({
    model: "mini",
    output: s.object({
        category: s.enum("added", "changed", "deprecated", "removed", "fixed", "security"),
        entry: s.string
    }),
    instructions: `Convert the change description to Keep a Changelog style.`,
});

export default categorize;
```
