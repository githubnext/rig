# 357 - TS Decorator Usage Scanner

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanDecorators = defineTool("scanDecorators", {
  description: "Scan a TypeScript file for decorator usage and return decorator names with their count.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const decoratorRegex = /@([A-Z][a-zA-Z0-9]*)/g;
      const found: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = decoratorRegex.exec(content)) !== null) {
        found.push(match[1]);
      }
      return { decorators: found, hasDecorators: found.length > 0 };
    } catch {
      return { decorators: [], hasDecorators: false };
    }
  },
});

// Agent role: scan TypeScript files for decorator usage and summarize which decorators are most common.
const tsDecoratorUsageScanner = agent({
  model: "small",
  instructions: p`Scan TypeScript files for decorator usage (e.g. @Injectable, @Component).

TypeScript files: ${p.glob("src/**/*.ts")}

Steps:
1. For each file path, call scanDecorators to get the list of decorator names used.
2. Aggregate across all files: build a decorators record keyed by decorator name (without @),
   with usageCount (total occurrences) and files (list of file paths where it appears).
3. totalDecorated = number of files that had at least one decorator.
4. mostUsedDecorator = decorator name with highest usageCount (omit if none found).`,
  output: s.object({
    decorators: s.record(s.object({
      usageCount: s.int,
      files: s.array(s.path),
    })),
    totalDecorated: s.int,
    mostUsedDecorator: s.optional(s.string),
  }),
  tools: [scanDecorators],
  addons: [repair()],
});

export default tsDecoratorUsageScanner;

```
