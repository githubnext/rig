# 212 - Ts Export Usage Counter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const countUsages = defineTool("countUsages", {
  description: "Count how many times a symbol appears in TypeScript source files",
  parameters: s.object({ symbolName: s.string }),
  async handler({ symbolName }) {
    const { execSync } = await import("node:child_process");
    try {
      const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const out = execSync(
        `grep -rn "${escaped}" --include="*.ts" . | grep -v node_modules | grep -v ".d.ts" | wc -l`,
        { encoding: "utf8" }
      );
      const count = parseInt(out.trim(), 10);
      const lastFile = execSync(
        `grep -rln "${escaped}" --include="*.ts" . | grep -v node_modules | tail -1`,
        { encoding: "utf8" }
      ).trim() || null;
      return { count, lastFile };
    } catch {
      return { count: 0, lastFile: null };
    }
  },
});

// Agent role: scan TypeScript exports and measure how often each exported symbol is imported or used.
const tsExportUsageCounter = agent({
  model: "small",
  instructions: p`Find exported TypeScript symbols: ${p.bash("grep -rn 'export ' --include='*.ts' . | grep -v node_modules | grep -v '.d.ts' | grep -E 'export (const|function|class|type|interface|enum) ' | head -60")}. For each exported symbol name, use the countUsages tool to get how many times it appears in the codebase. Assign coverageLevel: none (0 usages), low (1–2), medium (3–9), or high (≥10). Return a record keyed by symbol name.`,
  output: s.record(s.object({
    usageCount: s.int,
    coverageLevel: s.enum("none", "low", "medium", "high"),
    lastFile: s.optional(s.string),
  })),
  tools: [countUsages],
  maxTurns: 6,
  addons: repair(),
});

export default tsExportUsageCounter;
```
