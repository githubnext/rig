# 29 - Bug Report Draft

```rig
import { agent, p, s } from "rig";
// Agent role: flag unknown or concerning dependency licenses.
const licenseCheck = agent({
    model: "mini",
    output: s.object({
        compliant: s.boolean,
        unknown: s.array(s.string),
        concerning: s.array(s.object({
            package: s.string,
            license: s.string,
            reason: s.string
        }))
    }),
    instructions: `Flag unknown or concerning dependency licenses.`,
});

export default licenseCheck;
```
