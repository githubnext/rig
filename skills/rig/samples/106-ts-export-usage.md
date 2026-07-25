# 106 - TS Export Usage

```rig
import { agent, p, s, defineTool } from "rig";

const scanUsage = defineTool("scanUsage", {
  description: "Count how many times a symbol name appears across TypeScript files (approximate usage)",
  parameters: s.object({ symbol: s.string }),
  async handler({ symbol }) {
    const { execSync } = await import("node:child_process");
    try {
      const result = execSync(
        `grep -rn --include="*.ts" "\\b${symbol}\\b" . | grep -v "^.*export " | grep -v node_modules | wc -l`,
        { encoding: "utf8" }
      ).trim();
      return { count: parseInt(result, 10) || 0 };
    } catch {
      return { count: 0 };
    }
  },
});

// Agent role: count usage of exported TypeScript symbols and classify coverage level.
const tsExportUsage = agent({
  model: "small",
  instructions: p`Find all exported symbols in TypeScript files: ${p.bash("grep -rn --include='*.ts' 'export (function|class|const|type|interface)' . | grep -v node_modules | head -40")}. For each symbol name, use the scanUsage tool to count references. Classify coverageLevel as none (0 usages), low (1-2), medium (3-9), high (≥10). Record the file where the symbol was last found as lastFile if available.`,
  output: s.record(s.object({
    usageCount: s.number,
    coverageLevel: s.enum("none", "low", "medium", "high"),
    lastFile: s.optional(s.string),
  })),
  tools: [scanUsage],
});

export default tsExportUsage;
```
