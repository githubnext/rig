# 122 - Import Cycle Detector

```rig
import { agent, p, s, repair } from "rig";

// Agent role: detect import cycles in a TypeScript project and assess their severity
const importCycleDetector = agent({
  name: "importCycleDetector",
  model: "small",
  maxTurns: 3,
  addons: repair(),
  instructions: p`Detect circular imports in this TypeScript project.

Madge circular analysis: ${p.bash("npx madge --circular --extensions ts . 2>/dev/null || echo 'madge not available, use heuristic analysis'")}

TypeScript config: ${p.readOptional("tsconfig.json", "{}")}

Source files: ${p.bash("find . -type f -name '*.ts' -not -path '*/node_modules/*' | head -30")}

Identify any circular import cycles. For each cycle, list the file path array forming the cycle and rate severity:
- high: cycles involving core modules or many files
- medium: cycles involving 3–5 files
- low: simple two-file cycles

Set hasCycles to true if any cycles exist. Provide a recommendation for resolving them.`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(
      s.object({
        path: s.array(s.string),
        severity: s.enum("high", "medium", "low"),
      })
    ),
    cycleCount: s.int,
    recommendation: s.string,
  }),
});

export default importCycleDetector;
```
