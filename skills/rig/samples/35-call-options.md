# 35 - Call Options

```rig
import { agent, p, s } from "rig";
// Agent role: parse environment outputs.
const envReader = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        nodeMajor: s.number,
        files: s.array(s.string)
    }),
    instructions: `Parse environment outputs.`,
});

export default envReader;
```
