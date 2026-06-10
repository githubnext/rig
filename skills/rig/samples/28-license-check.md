# 28 - License Check

```rig
import { agent, p, s } from "rig";
// Agent role: plan safe dependency upgrades.
const upgradePlan = agent({
    model: "mini",
    output: s.object({
        upgrades: s.array(s.object({
            package: s.string,
            from: s.string,
            to: s.string,
            risk: s.string
        })),
        order: s.array(s.string)
    }),
    instructions: `Plan safe dependency upgrades.`,
});

export default upgradePlan;
```
