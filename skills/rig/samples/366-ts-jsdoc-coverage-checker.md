# 366 - TS JSDoc Coverage Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const analyzeFunctionComments = defineTool("analyzeFunctionComments", {
  description: "Scan a TypeScript file for exported functions and count those with and without JSDoc comments.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      let documentedCount = 0;
      let undocumentedCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^export\s+(async\s+)?function\s+\w+/.test(line) || /^export\s+const\s+\w+\s*=\s*(async\s*)?\(/.test(line)) {
          const prevLine = lines[i - 1]?.trim() ?? "";
          const prevPrevLine = lines[i - 2]?.trim() ?? "";
          if (prevLine.endsWith("*/") || prevPrevLine.endsWith("*/") || prevLine.startsWith("/**") || prevLine.startsWith("*")) {
            documentedCount++;
          } else {
            undocumentedCount++;
          }
        }
      }
      const total = documentedCount + undocumentedCount;
      const coverage = total > 0 ? documentedCount / total : 1;
      return { documentedCount, undocumentedCount, coverage };
    } catch {
      return { documentedCount: 0, undocumentedCount: 0, coverage: 0 };
    }
  },
});

const tsJsDocCoverageChecker = agent({
  model: "small",
  instructions: p`Check JSDoc coverage for exported TypeScript functions.

TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -20")}

Steps:
1. For each file path, call analyzeFunctionComments to get documentedCount, undocumentedCount, and coverage.
2. Build files record keyed by file path with those three values.
3. overall: totalFunctions = sum of all (documentedCount + undocumentedCount), documentedFunctions = sum of all documentedCount, coveragePercent = (documentedFunctions / totalFunctions) * 100 (or 100 if no functions).
4. wellDocumentedFiles = file paths where coverage >= 0.8.`,
  output: s.object({
    files: s.record(
      s.object({
        documentedCount: s.number,
        undocumentedCount: s.number,
        coverage: s.number,
      })
    ),
    overall: s.object({
      totalFunctions: s.number,
      documentedFunctions: s.number,
      coveragePercent: s.number,
    }),
    wellDocumentedFiles: s.array(s.string),
  }),
  tools: [analyzeFunctionComments],
  addons: [repair()],
});

export default tsJsDocCoverageChecker;
```
