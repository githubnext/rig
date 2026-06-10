# 20 - Issue Reproducer

```rig
import { agent, p, s } from "rig";
const Diagnosis = s.object({ rootCause: s.string, confidence: s.number });
// Agent role: diagnose the failing test output.
const diagnose = agent({ model: "mini", output: Diagnosis, instructions: "Diagnose the failing test output." });
// Agent role: write the smallest safe patch for the diagnosis.
const fix = agent({ model: "mini", input: s.object({ diagnosis: Diagnosis }), instructions: "Write the smallest safe patch." });
// Agent role: reproduce and fix the bug using the provided specialists when helpful.
const issueReproducer = agent({
  model: "mini",
  instructions: p`Reproduce the failing test from ${p.bash("npm test")} and use the specialists when helpful.`,
  output: s.object({ diagnosis: Diagnosis, fixSummary: s.string, approved: s.boolean }),
  agents: { diagnose, fix },
});
export default issueReproducer;
```
