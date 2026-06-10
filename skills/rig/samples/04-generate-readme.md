# 04 - Generate Readme

```rig
import { agent, p, s } from "rig";
const ShResult = s.object({
    ok: s.boolean,
    stdout: s.string,
    stderr: s.string,
    exitCode: s.number
});
// Agent role: diagnose the failing test result. Do not edit files.
const diagnose = agent({
    model: "mini",
    output: s.object({
        rootCause: s.string,
        confidence: s.number,
        relevantFiles: s.array(s.string),
        nextSteps: s.array(s.string)
    }),
    instructions: `
    Diagnose the failing test result.
    Do not edit files.
  `,
});

export default diagnose;
```
