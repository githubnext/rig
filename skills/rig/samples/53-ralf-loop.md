# 53 - RALF Loop (Run, Analyze, Loop, Fix)

```rig
import { agent, p, s } from "rig";
// Agent role: diagnose failing tests and decide if the loop is done.
const diagnose = agent({
  model: "mini",
  input: s.object({ ok: s.boolean, stdout: s.string, exitCode: s.number }),
  output: s.object({ done: s.boolean, rootCause: s.string }),
  instructions: "Diagnose test failures. Set done to true if all tests passed.",
});
// Agent role: apply the smallest safe fix for the root cause.
const fix = agent({
  model: "mini",
  output: s.object({ summary: s.string, changed: s.boolean }),
  instructions: "Apply the smallest safe fix for the root cause.",
});
// Agent role: run a RALF loop iterating diagnose-fix cycles until tests pass.
const ralfLoop = agent({
  model: "large",
  output: s.object({ iterations: s.number, fixed: s.boolean }),
  agents: { diagnose, fix },
  instructions: p`Run ${p.bash("npm test")} then loop: diagnose failures, fix, repeat up to 3 times.`,
});
export default ralfLoop;
```
