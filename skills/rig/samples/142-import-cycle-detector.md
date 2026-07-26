# 142 - Import Cycle Detector

```rig
import { agent, p, s, repair } from "rig";

// Agent role: Detect import cycles in TypeScript source using madge and classify severity.
const importCycleDetector = agent({
  model: "small",
  maxTurns: 3,
  instructions: p`Detect circular import cycles in this TypeScript project.

Run madge to find circular dependencies:
${p.bash("npx madge --circular --json . 2>/dev/null || echo '[]'")}

Also read the TypeScript config:
${p.readOptional("tsconfig.json", "{}")}

For each cycle found, classify severity:
- high: cycle involves more than 3 files or includes entry points
- medium: cycle involves 2-3 files
- low: short cycle between utility files

Return the structured output with hasCycles, cycles array, and totalCycles count.`,
  addons: repair(),
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(
      s.object({
        path: s.array(s.string),
        severity: s.enum("high", "medium", "low"),
      }),
    ),
    totalCycles: s.int,
  }),
});

export default importCycleDetector;
```
