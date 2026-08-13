# 416 - Source Comment Density Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: measure comment density across TypeScript source files.
const sourceCommentDensityReporter = agent({
  model: "small",
  instructions: p`Measure comment density for TypeScript source files.

Source files: ${p.glob("src/**/*.ts")}

For each file path, call measureCommentDensity. Then produce the declared output.`,
  tools: [
    defineTool("measureCommentDensity", {
      description: "Count comment lines vs code lines in a TypeScript file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n");
          let commentLines = 0;
          let inBlock = false;
          for (const line of lines) {
            const t = line.trim();
            if (inBlock) { commentLines++; if (t.includes("*/")) inBlock = false; }
            else if (t.startsWith("/*") || t.startsWith("*")) { commentLines++; if (!t.includes("*/")) inBlock = true; }
            else if (t.startsWith("//")) commentLines++;
          }
          const codeLines = lines.length - commentLines;
          const density = lines.length > 0 ? commentLines / lines.length : 0;
          return { commentLines, codeLines, density };
        } catch {
          return { commentLines: 0, codeLines: 0, density: 0 };
        }
      },
    }),
  ],
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
  addons: [repair()],
});

export default sourceCommentDensityReporter;

```
