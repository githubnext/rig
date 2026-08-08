# 371 - TypeScript Dead Export Finder

```rig
import { agent, defineTool, p, s, repair, steering } from "rig";
import { readFile } from "node:fs/promises";

const findUnusedExports = defineTool("findUnusedExports", {
  description: "Given a list of TS file paths and their exported symbols, return which exports are not imported in any other file",
  parameters: s.object({
    files: s.array(s.string("file path")),
  }),
  async handler({ files }) {
    const exportedSymbols: Record<string, string[]> = {};
    const allContent: string[] = [];
    for (const f of files) {
      try {
        const src = await readFile(f, "utf8");
        allContent.push(src);
        const matches = [...src.matchAll(/^export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/gm)];
        exportedSymbols[f] = matches.map((m) => m[1]);
      } catch {
        exportedSymbols[f] = [];
      }
    }
    const combinedContent = allContent.join("\n");
    const unusedExports: Record<string, string[]> = {};
    for (const [file, symbols] of Object.entries(exportedSymbols)) {
      const unused = symbols.filter((sym) => {
        const importPattern = new RegExp(`import[^;]+\\b${sym}\\b`);
        return !importPattern.test(combinedContent);
      });
      if (unused.length > 0) unusedExports[file] = unused;
    }
    return JSON.stringify(unusedExports);
  },
});

// Agent role: find TypeScript exported symbols that are not imported anywhere else in the project.
const deadExportFinder = agent({
  model: "small",
  instructions: p`You are analyzing a TypeScript project for dead exports.

Files in the project:
${p.glob("**/*.ts")}

Use the findUnusedExports tool with all discovered .ts file paths (excluding node_modules) to identify exported symbols that are never imported.

Return the results in the declared output schema.`,
  output: s.object({
    unusedExports: s.record(s.array(s.string)),
    totalUnused: s.int,
    hasDeadCode: s.boolean,
  }),
  tools: [findUnusedExports],
  addons: [steering(), repair()],
});

export default deadExportFinder;
```
