# 346 - JS AST Node Counter

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const countAstNodes = defineTool("countAstNodes", {
  description: "Count function/arrow/class/import/export patterns in a TypeScript file using regex heuristics",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    let source = "";
    try { source = await readFile(filePath, "utf8"); } catch { return { functions: 0, arrows: 0, classes: 0, imports: 0, exports: 0 }; }
    const functions = (source.match(/\bfunction\s+\w+/g) || []).length;
    const arrows = (source.match(/=>\s*[{(]/g) || []).length;
    const classes = (source.match(/\bclass\s+\w+/g) || []).length;
    const imports = (source.match(/^import\b/gm) || []).length;
    const exports = (source.match(/^export\b/gm) || []).length;
    return { functions, arrows, classes, imports, exports };
  },
});

// Agent role: count AST-like node patterns in each TypeScript source file and identify the most complex file.
const jsAstNodeCounter = agent({
  model: "small",
  instructions: p`TypeScript files in this workspace: ${p.glob("src/**/*.ts")}

For each file path listed, call countAstNodes to get pattern counts. Build a record keyed by file path. Sum all functions across files into totalFunctions. Set mostComplexFile to the file with the highest combined function+arrow+class count (omit if no files found).`,
  output: s.object({
    files: s.record(s.object({
      functions: s.int,
      arrows: s.int,
      classes: s.int,
      imports: s.int,
      exports: s.int,
    })),
    totalFunctions: s.int,
    mostComplexFile: s.optional(s.path),
  }),
  tools: [countAstNodes],
  maxTurns: 6,
});

export default jsAstNodeCounter;
```
