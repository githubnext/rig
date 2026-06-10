# 03 - Diagnose Test Failure

```rig
import { agent, p, s } from "rig";
// Agent role: review input.diff for correctness and regression risks. Return only the declared output shape.
const reviewer = agent({
    model: "mini",
    output: s.object({
        summary: s.string,
        risk: s.enum("low", "medium", "high"),
        findings: s.array(s.object({
            severity: s.enum("info", "warning", "error"),
            message: s.string,
            file: s.optional(s.string),
            line: s.optional(s.number)
        })),
        tests: s.array(s.string)
    }),
    instructions: `
    Review input.diff for correctness and regression risks.
    Return only the declared output shape.
  `,
});

export default reviewer;
```
