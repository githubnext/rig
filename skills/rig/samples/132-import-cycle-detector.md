# 132 - Import Cycle Detector

```rig
import { agent, p, s } from "rig";

// Agent role: detect circular import cycles in the TypeScript project and classify severity.
const importCycleDetector = agent({
  model: "small",
  maxTurns: 6,
  instructions: p`Detect circular imports in this TypeScript project.

TypeScript config: ${p.bash("cat tsconfig.json 2>/dev/null || echo '{}'")}

Circular dependency check: ${p.bash("npx --yes madge --circular --extensions ts . 2>/dev/null || echo 'madge unavailable'")}

Import graph sample: ${p.bash("grep -r --include='*.ts' -h 'from ' . 2>/dev/null | grep -v node_modules | head -60")}

Identify all circular import chains. For each cycle, list the path as an array of module names and classify severity: high (core/shared modules), medium (feature modules), low (utility/test files). Set hasCycles to true if any cycles were found.`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(s.object({
      path: s.array(s.string),
      severity: s.enum("high", "medium", "low"),
    })),
  }),
});

export default importCycleDetector;
```
