# 233 - Barrel File Generator V3

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const detectExports = defineTool("detectExports", {
  description: "Detect exported symbols from a TypeScript source file.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const exportMatches = content.match(/^export\s+(?:default\s+)?(?:const|function|class|type|interface|enum)\s+(\w+)/gm) ?? [];
    const symbols = exportMatches.map(m => {
      const match = m.match(/(\w+)\s*$/);
      return match ? match[1] : "";
    }).filter(Boolean);
    return { filePath, symbols, count: symbols.length };
  },
});

// Agent role: scan TypeScript source files and generate a barrel index.ts with all exports.
const barrelFileGenerator = agent({
  model: "small",
  instructions: p`Generate a TypeScript barrel file (index.ts) that re-exports all symbols from source files.

Source files: ${p.glob("src/**/*.ts")}

For each file path above, call the detectExports tool to find exported symbols.
Then generate the barrel file content as a series of export statements.
Write it to ${p.writeOutput("barrelContent", "src/index.ts")}.
Return the file count, export count, barrel content, and output path.`,
  output: s.object({
    filesScanned: s.int,
    exportCount: s.int,
    barrelContent: s.string,
    outputPath: s.path,
  }),
  tools: [detectExports],
  addons: [repair()],
});

export default barrelFileGenerator;
```
