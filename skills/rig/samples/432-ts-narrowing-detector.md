# 432 - TypeScript Narrowing Detector

```rig
import { readFile } from "node:fs/promises";
import { agent, p, s, defineTool, repair } from "rig";

const scanNarrowingPatterns = defineTool("scanNarrowingPatterns", {
  description: "Count typeof, instanceof, and 'in' operator narrowing patterns in a TypeScript file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const content = await readFile(filePath, "utf8");
    const typeofCount = (content.match(/typeof\s+\w+/g) ?? []).length;
    const instanceofCount = (content.match(/\w+\s+instanceof\s+\w+/g) ?? []).length;
    const inOperatorCount = (content.match(/\w+\s+in\s+\w+/g) ?? []).length;
    return { typeofCount, instanceofCount, inOperatorCount };
  },
});

// Agent role: Scan TypeScript source files for type narrowing patterns and report counts per file.
const tsNarrowingDetector = agent({
  name: "ts-narrowing-detector",
  model: "small",
  maxTurns: 6,
  instructions: p`You are a TypeScript narrowing pattern analyzer. Here are the TypeScript source files:
${p.glob("src/**/*.ts")}

For each file, call scanNarrowingPatterns. Then return the output with files (a record keyed by filepath), totalFiles, mostNarrowedFile (the file with the highest total patterns, if any), and totalNarrowingPatterns.`,
  output: s.object({
    files: s.record(s.object({ typeofCount: s.int, instanceofCount: s.int, inOperatorCount: s.int })),
    totalFiles: s.int,
    mostNarrowedFile: s.optional(s.string),
    totalNarrowingPatterns: s.int,
  }),
  tools: [scanNarrowingPatterns],
  addons: [repair()],
});

export default tsNarrowingDetector;
```
