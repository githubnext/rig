# 226 - Js Ast Node Counter

```rig
import { agent, defineTool, p, s } from "rig";

const countAstNodes = defineTool("countAstNodes", {
  description: "Count syntax node patterns in a JavaScript/TypeScript file using regex heuristics",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf-8");
      const functionCount = (content.match(/\bfunction\s+\w+\s*\(/g) ?? []).length;
      const arrowFunctionCount = (content.match(/=>\s*[{(]/g) ?? []).length;
      const classCount = (content.match(/\bclass\s+\w+/g) ?? []).length;
      const importCount = (content.match(/^\s*import\s+/gm) ?? []).length;
      const exportCount = (content.match(/^\s*export\s+/gm) ?? []).length;
      return { filePath, functionCount, arrowFunctionCount, classCount, importCount, exportCount };
    } catch {
      return { filePath, functionCount: 0, arrowFunctionCount: 0, classCount: 0, importCount: 0, exportCount: 0 };
    }
  },
});

// Agent role: count AST-like syntax node patterns in JavaScript files.
const jsAstNodeCounter = agent({
  model: "small",
  instructions: p`Find JavaScript files: ${p.bash("find . -name '*.js' ! -path '*/node_modules/*' ! -path '*/.git/*' | head -10 2>/dev/null || echo 'no js files found'")}. For each file, call countAstNodes and collect results. Tally totalFunctions across all files and identify mostComplexFile (highest combined function + arrowFunction count). Return only the declared output.`,
  tools: [countAstNodes],
  output: s.object({
    files: s.record(s.object({
      functionCount: s.int,
      arrowFunctionCount: s.int,
      classCount: s.int,
      importCount: s.int,
      exportCount: s.int,
    })),
    totalFunctions: s.int,
    mostComplexFile: s.optional(s.path),
  }),
});

export default jsAstNodeCounter;
```
