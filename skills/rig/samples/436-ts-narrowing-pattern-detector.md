# 436 - TS Narrowing Pattern Detector

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanNarrowingPatterns = defineTool("scanNarrowingPatterns", {
  description: "Scan a TypeScript file for type narrowing patterns (typeof, instanceof, in operator).",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8");
    const typeofCount = (content.match(/typeof\s+\w+\s*[=!]==?\s*["']/g) ?? []).length;
    const instanceofCount = (content.match(/\w+\s+instanceof\s+\w+/g) ?? []).length;
    const inOperatorCount = (content.match(/["']\w+["']\s+in\s+\w+/g) ?? []).length;
    return { typeofCount, instanceofCount, inOperatorCount };
  },
});

// Agent role: Detect TypeScript type narrowing patterns across source files.
const tsNarrowingDetector = agent({
  model: "small",
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. Use scanNarrowingPatterns on each file. Return counts per file and totals.`,
  output: s.object({
    files: s.record(s.object({
      typeofCount: s.int,
      instanceofCount: s.int,
      inOperatorCount: s.int,
    })),
    totalFiles: s.int,
    mostNarrowedFile: s.optional(s.string),
    totalNarrowingPatterns: s.int,
  }),
  tools: [scanNarrowingPatterns],
  addons: [repair()],
});

export default tsNarrowingDetector;
```
