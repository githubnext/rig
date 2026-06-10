# 30 - Github Action Review

```rig
import { agent, p, s } from "rig";
// Agent role: draft a GitHub bug report from the failure details.
const bugReport = agent({
    model: "mini",
    output: s.object({
        title: s.string,
        body: s.string,
        labels: s.array(s.string)
    }),
    instructions: `Draft a GitHub bug report from the failure details.`,
});

export default bugReport;
```
