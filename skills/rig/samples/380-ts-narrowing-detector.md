# 380 - TypeScript Narrowing Pattern Detector

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanNarrowingPatterns = defineTool("scanNarrowingPatterns", {
  description: "Count typeof, instanceof, and 'in' operator usages in a TypeScript file.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const typeofCount = (content.match(/\btypeof\s+\w+\s*[=!]==/g) ?? []).length;
      const instanceofCount = (content.match(/\binstanceof\b/g) ?? []).length;
      const inOperatorCount = (content.match(/\b\w+\s+in\s+\w+/g) ?? []).length;
      const total = typeofCount + instanceofCount + inOperatorCount;
      return { typeofCount, instanceofCount, inOperatorCount, total };
    } catch {
      return { typeofCount: 0, instanceofCount: 0, inOperatorCount: 0, total: 0 };
    }
  },
});

// Agent role: detect TypeScript type narrowing patterns across source files.
const tsNarrowingDetector = agent({
  model: "small",
  instructions: p`Detect type narrowing patterns in TypeScript source files.

Source files:
${p.glob("src/**/*.ts")}

Steps:
1. For each file path, call scanNarrowingPatterns to get typeofCount, instanceofCount, inOperatorCount, total.
2. Build files record keyed by file path.
3. totalFiles = number of files scanned.
4. mostNarrowedFile = file path with the highest total (omit if all are zero).
5. totalNarrowingPatterns = sum of total across all files.`,
  output: s.object({
    files: s.record(
      s.object({
        typeofCount: s.int,
        instanceofCount: s.int,
        inOperatorCount: s.int,
        total: s.int,
      })
    ),
    totalFiles: s.int,
    mostNarrowedFile: s.optional(s.string),
    totalNarrowingPatterns: s.int,
  }),
  tools: [scanNarrowingPatterns],
  addons: [repair()],
});

export default tsNarrowingDetector;
```
