# 34 - Intent Options

```rig
import { agent, p, s } from "rig";
// Agent role: investigate the project using only readonly evidence.
const investigator = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        observations: s.array(s.string),
        likelyEntryPoints: s.array(s.string)
    }),
    instructions: `Investigate the project using only readonly evidence.`,
});

export default investigator;
```
