# 115 - Import Cycle Detector

```rig
import { agent, p, s } from "rig";

// Agent role: detect circular import cycles in the TypeScript project.
const importCycleDetector = agent({
  model: "mini",
  maxTurns: 6,
  instructions: p`Detect circular imports in this TypeScript project.

TypeScript config:
${p.bash("cat tsconfig.json 2>/dev/null || echo '{}'")}

Circular imports (via madge):
${p.bash("npx --yes madge --circular --extensions ts . 2>/dev/null || echo 'madge not available or no cycles found'")}

Alternatively, check for potential cycles by scanning imports:
${p.bash("grep -r --include='*.ts' 'from.*\\.' . 2>/dev/null | grep -v node_modules | head -50")}

Identify any circular import chains. For each cycle, classify severity:
- high: cycles in core/shared modules
- medium: cycles in feature modules
- low: cycles in utility or test files

Return only the declared output.`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(
      s.object({
        path: s.array(s.string),
        severity: s.enum("high", "medium", "low"),
      })
    ),
    cycleCount: s.int,
  }),
});

export default importCycleDetector;
```
