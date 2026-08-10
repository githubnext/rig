# 391 - TypeScript Barrel Re-Exporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: scan a source directory, extract exported symbols from each .ts file,
// and write a barrel index.ts file re-exporting all discovered symbols.
const tsBarrelReExporter = agent({
  model: "small",
  input: s.object({ sourceDir: s.string, outputFile: s.string }),
  instructions: p`You are given sourceDir and outputFile in the input.
List .ts files (excluding index.ts): ${p.bash("find . -name '*.ts' -not -name 'index.ts' -not -name '*.d.ts' 2>/dev/null | head -30")}
For each relevant file in sourceDir, call extractExportedSymbols.
Then call p.write equivalent: use the write intent below to persist the barrel.
${p.writeOutput("barrelContent", "barrel-out.ts")}
Return the declared output schema.`,
  tools: [
    defineTool("extractExportedSymbols", {
      description: "Read a TypeScript file and return all top-level exported symbol names",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const symbols: string[] = [];
        for (const m of content.matchAll(/^export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/gm)) {
          symbols.push(m[1]);
        }
        return { filePath, symbols };
      },
    }),
  ],
  output: s.object({
    exports: s.array(s.string),
    outputFile: s.string,
    totalExports: s.int,
    filesScanned: s.int,
    barrelContent: s.string,
  }),
  addons: [repair()],
});

export default tsBarrelReExporter;
```
