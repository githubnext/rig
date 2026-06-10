# 33 - Readonly Investigator

```rig
import { agent, s } from "rig";
// Agent role: plan shell commands for the goal. Prefer readonly commands.
const commandPlanner = agent({
    model: "mini",
    output: s.object({
        commands: s.array(s.object({
            command: s.string,
            purpose: s.string,
            readonly: s.boolean
        }))
    }),
    instructions: `Plan shell commands for the goal. Prefer readonly commands.`,
});

export default commandPlanner;
```
