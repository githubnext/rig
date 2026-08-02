# 351 - TS Import Depth Analyzer V2

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const analyzeImportDepth = defineTool("analyzeImportDepth", {
  description: "Analyze relative import depth in a TypeScript file by counting '../' occurrences.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    const relativeImports = imports.filter((i: string) => i.startsWith("."));
    const depths = relativeImports.map((i: string) => (i.match(/\.\.\//g) ?? []).length);
    const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
    const deepImports = relativeImports.filter((i: string) => (i.match(/\.\.\//g) ?? []).length >= 2);
    return { maxDepth, deepImports, importCount: imports.length };
  },
});

// Agent role: analyze relative import depth across TypeScript files to find overly deep imports.
const tsImportDepthAnalyzer = agent({
  model: "small",
  instructions: p`Analyze TypeScript import depth across all source files.

Source files to analyze: ${p.glob("**/*.ts")}

For each .ts file (excluding node_modules), call analyzeImportDepth to get maxDepth, deepImports, and importCount.
Calculate the average depth across all files (sum of maxDepths / file count).
Identify the file with the highest maxDepth as deepestFile (omit if no files).
Return the full per-file record plus summary stats.`,
  output: s.object({
    files: s.record(s.object({
      maxDepth: s.int,
      deepImports: s.array(s.string),
      importCount: s.int,
    })),
    deepestFile: s.optional(s.path),
    averageDepth: s.number,
  }),
  tools: [analyzeImportDepth],
  addons: [repair()],
});

export default tsImportDepthAnalyzer;

```
