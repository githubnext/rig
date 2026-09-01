# 491 - Dotenv Process Drift Detector

```rig
import { agent, defineTool, p, s, repair } from "rig";

const classifyEnvKey = defineTool("classifyEnvKey", {
  description: "Classify an env key based on whether it's in .env.example and used in code",
  parameters: s.object({ key: s.string, inExample: s.boolean, usedInCode: s.boolean }),
  handler({ inExample, usedInCode }): "declared_and_used" | "declared_not_used" | "used_not_declared" {
    if (inExample && usedInCode) return "declared_and_used" as const;
    if (inExample && !usedInCode) return "declared_not_used" as const;
    return "used_not_declared" as const;
  },
});

// Agent role: detect drift between .env.example declarations and actual process.env usages in source code.
const dotenvDriftDetector = agent({
  model: "small",
  instructions: p`Compare declared env keys in ${p.read(".env.example")} with actual usages from ${p.bash("grep -rn 'process\\.env\\.' src/ 2>/dev/null || true")}. Use classifyEnvKey for each key found. Return the full drift report.`,
  output: s.object({
    keys: s.record(s.object({ inExample: s.boolean, usedInCode: s.boolean, status: s.string })),
    totalKeys: s.int,
    missingFromExample: s.array(s.string),
    unusedDeclarations: s.array(s.string),
  }),
  tools: [classifyEnvKey],
  addons: [repair()],
});

export default dotenvDriftDetector;
```
