# 318 - Ts Barrel Re Exporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: generate a barrel index.ts that re-exports all exported symbols from TypeScript files in a directory.
const tsBarrelReExporter = agent({
  model: "small",
  input: s.object({
    sourceDir: s.path,
    outputFile: s.path,
  }),
  instructions: p`You are a TypeScript barrel re-exporter.

Find TypeScript source files to barrel (excluding index files):
${p.bash("find . -name '*.ts' -not -name 'index.ts' -not -name '*.test.ts' -not -name '*.d.ts' -not -path '*/node_modules/*' | head -50")}

For each TypeScript file in the source directory, call extractExportedSymbols to discover exported names.
Then write the barrel file to ${p.writeInput("outputFile", "barrelContent")}.
Return the declared output.`,
  tools: [
    defineTool("extractExportedSymbols", {
      description: "Read a TypeScript file and extract all top-level exported symbol names",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const symbols: string[] = [];
        const exportRegex = /^export\s+(?:(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)|(\{[^}]+\}))/gm;
        for (const match of content.matchAll(exportRegex)) {
          if (match[1]) {
            symbols.push(match[1]);
          } else if (match[2]) {
            const named = match[2].replace(/[{}]/g, "").split(",").map((s: string) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
            symbols.push(...named);
          }
        }
        return { filePath, symbols };
      },
    }),
  ],
  output: s.object({
    exports: s.array(s.string),
    outputFile: s.path,
    totalExports: s.int,
    filesScanned: s.int,
  }),
  addons: [repair()],
});

export default tsBarrelReExporter;
```
