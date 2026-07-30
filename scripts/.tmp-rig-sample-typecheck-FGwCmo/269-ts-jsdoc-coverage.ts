import { agent, p, s, defineTool, repair } from "rig";

const analyzeFunctionComments = defineTool("analyzeFunctionComments", {
  description: "Count exported functions with and without JSDoc comments in a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch {
      return { documentedCount: 0, undocumentedCount: 0, coverage: 0 };
    }
    const lines = content.split("\n");
    let documentedCount = 0;
    let undocumentedCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (/^\s*export\s+(async\s+)?function\s+\w+|^\s*export\s+const\s+\w+\s*=\s*(async\s*)?\(/.test(line)) {
        const prevLine = lines[i - 1] ?? "";
        const prevPrevLine = lines[i - 2] ?? "";
        if (/\*\//.test(prevLine) || /\*\//.test(prevPrevLine)) {
          documentedCount++;
        } else {
          undocumentedCount++;
        }
      }
    }
    const total = documentedCount + undocumentedCount;
    return {
      documentedCount,
      undocumentedCount,
      coverage: total > 0 ? Math.round((documentedCount / total) * 100) / 100 : 1,
    };
  },
});

// Agent role: measure JSDoc comment coverage for exported functions across TypeScript files.
const tsJsdocCoverage = agent({
  model: "typecheck",
  addons: repair(),
  instructions: p`Measure JSDoc coverage for exported functions in TypeScript source files.

TypeScript files in this project:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -20")}

For each file path listed, call analyzeFunctionComments to get documentedCount,
undocumentedCount, and coverage (0–1 ratio).
Build the files record keyed by file path.
Compute overall totals: totalFunctions, documentedFunctions, coveragePercent (0–100).
List wellDocumentedFiles: file paths where coverage >= 0.8.`,
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
});

export default tsJsdocCoverage;
