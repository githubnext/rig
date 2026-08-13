# 419 - Dotenv Drift Detector

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: detect drift between .env.example declarations and actual process.env usage in source code.
const dotenvDriftDetector = agent({
  model: "small",
  instructions: p`Detect drift between .env.example and actual process.env key usage in source code.

.env.example contents:
${p.readOptional(".env.example", "(no .env.example found)")}

process.env usages in source:
${p.bash("grep -rn 'process\\.env\\.' src/ --include='*.ts' 2>/dev/null | head -100 || echo '(none found)'")}

For each env key found in either source, call classifyEnvKey. Produce the declared output.`,
  tools: [
    defineTool("classifyEnvKey", {
      description: "Classify an env key based on whether it is in .env.example and/or used in code",
      parameters: s.object({ key: s.string, inExample: s.boolean, usedInCode: s.boolean }),
      handler({ key, inExample, usedInCode }: { key: string; inExample: boolean; usedInCode: boolean }) {
        let status: "declared" | "undeclared" | "unused" = "declared";
        if (usedInCode && !inExample) status = "undeclared";
        else if (!usedInCode && inExample) status = "unused";
        return { key, inExample, usedInCode, status };
      },
    }),
  ],
  output: s.object({
    keys: s.record(s.object({
      inExample: s.boolean,
      usedInCode: s.boolean,
      status: s.enum("declared", "undeclared", "unused"),
    })),
    totalKeys: s.int,
    missingFromExample: s.array(s.string),
    unusedDeclarations: s.array(s.string),
  }),
  addons: [repair()],
});

export default dotenvDriftDetector;

```
