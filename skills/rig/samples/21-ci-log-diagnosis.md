# 21 - Ci Log Diagnosis

```rig
import { agent, s } from "rig";
// Agent role: extract a clear reproduction from the issue.
const reproducer = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        steps: s.array(s.string),
        expected: s.string,
        actual: s.string,
        missingInfo: s.array(s.string)
    }),
    instructions: `Extract a clear reproduction from the issue.`,
});

export default reproducer;
```
