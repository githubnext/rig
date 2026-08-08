# 372 - TS JSDoc Coverage Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const analyzeFunctionComments = defineTool("analyzeFunctionComments", {
  description: "Count exported functions with and without JSDoc in a TypeScript file.",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    let documentedCount = 0;
    let undocumentedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^export\s+(async\s+)?function|^export\s+const\s+\w+\s*=\s*(async\s+)?\(/.test(lines[i])) {
        const preceding = lines.slice(Math.max(0, i - 3), i).join("\n");
        if (/\/\*\*/.test(preceding)) {
          documentedCount++;
        } else {
          undocumentedCount++;
        }
      }
    }
    const total = documentedCount + undocumentedCount;
    return { documentedCount, undocumentedCount, coverage: total > 0 ? documentedCount / total : 0 };
  },
});

// Agent role: check JSDoc coverage for exported functions across TypeScript files.
const tsJsdocCoverageChecker = agent({
  model: "small",
  instructions: p`Check JSDoc documentation coverage for exported TypeScript functions.

TypeScript source files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -20")}

For each TypeScript file found, call analyzeFunctionComments with the file path.
Build a files record keyed by file path with documentedCount, undocumentedCount, and coverage.
Compute overall: totalFunctions (sum of all), documentedFunctions (sum of documented), coveragePercent (as 0-100).
List wellDocumentedFiles: files where coverage >= 0.8 (as paths).`,
  tools: [analyzeFunctionComments],
  output: s.object({
    files: s.record(
      s.object({
        documentedCount: s.int,
        undocumentedCount: s.int,
        coverage: s.number,
      })
    ),
    overall: s.object({
      totalFunctions: s.int,
      documentedFunctions: s.int,
      coveragePercent: s.number,
    }),
    wellDocumentedFiles: s.array(s.path),
  }),
  maxTurns: 6,
  addons: repair(),
});

export default tsJsdocCoverageChecker;

```
