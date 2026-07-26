# 152 - Import Cycle Detector V3

```rig
import { agent, p, s, repair } from "rig";

// Agent role: detect circular import cycles in TypeScript source and classify severity.
const importCycleDetectorV3 = agent({
  model: "small",
  maxTurns: 3,
  addons: repair(),
  instructions: p`Detect circular import cycles in this TypeScript project.

Circular dependency analysis:
${p.bash("npx madge --circular --extensions ts src 2>/dev/null || echo 'No cycles found or madge not available'")}

TypeScript configuration:
${p.readOptional("tsconfig.json", "{}")}

Analyze the output above. Each cycle is a group of files that import each other in a
circle. Classify severity: high if the cycle involves more than 3 files or core modules,
medium for 2-3 files, low for simple two-file cycles.

Return hasCycles (true if any cycles found), the cycles array with path (array of file
strings in the cycle) and severity, and totalCycles count.`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(
      s.object({
        path: s.array(s.string),
        severity: s.enum("high", "medium", "low"),
      })
    ),
    totalCycles: s.int,
  }),
});

export default importCycleDetectorV3;
```
