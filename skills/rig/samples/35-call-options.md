# 35 - Call Options

```rig
import { agent, p, s } from "rig";
// Agent role: parse environment outputs.
const envReader = agent({
    model: "mini",
    output: s.object({
        nodeMajor: s.number,
        files: s.array(s.string)
    }),
    instructions: `Parse environment outputs.`,
});

export default envReader;
```
