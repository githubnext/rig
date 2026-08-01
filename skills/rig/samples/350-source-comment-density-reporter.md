# 350 - Source Comment Density Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const measureCommentDensity = defineTool("measureCommentDensity", {
  description: "Count comment lines vs code lines in a TypeScript file and return density ratio",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    let source = "";
    try { source = await readFile(filePath, "utf8"); } catch { return { commentLines: 0, codeLines: 0, density: 0 }; }
    const lines = source.split("\n");
    let commentLines = 0;
    let inBlock = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (inBlock) { commentLines++; if (trimmed.includes("*/")) inBlock = false; }
      else if (trimmed.startsWith("/*") || trimmed.startsWith("/**")) { commentLines++; if (!trimmed.includes("*/")) inBlock = true; }
      else if (trimmed.startsWith("//")) commentLines++;
    }
    const codeLines = lines.filter((l) => l.trim().length > 0).length - commentLines;
    const density = codeLines > 0 ? Math.round((commentLines / codeLines) * 100) / 100 : 0;
    return { commentLines, codeLines, density };
  },
});

// Agent role: measure comment density across TypeScript source files and identify highly commented files.
const sourceCommentDensityReporter = agent({
  model: "small",
  instructions: p`TypeScript source files: ${p.glob("src/**/*.ts")}

For each file path, call measureCommentDensity to get commentLines, codeLines, and density. Build a record keyed by file path. Compute overall averageDensity (average of all density values). List highDensityFiles where density > 0.3. Report totalFiles.`,
  output: s.object({
    files: s.record(s.object({
      commentLines: s.int,
      codeLines: s.int,
      density: s.number,
    })),
    overall: s.object({
      totalFiles: s.int,
      averageDensity: s.number,
      highDensityFiles: s.array(s.path),
    }),
  }),
  tools: [measureCommentDensity],
  addons: [repair()],
  maxTurns: 6,
});

export default sourceCommentDensityReporter;
```
