# 509 - TS Namespace Usage Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const scanNamespaces = defineTool("scanNamespaces", {
  description: "Scan a TypeScript file for namespace declarations and usages",
  parameters: s.object({ filePath: s.string }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const results: Record<string, { declarationCount: number; accessCount: number; augmentationCount: number }> = {};
    const declRe = /\bnamespace\s+(\w+)/g;
    const augRe = /declare\s+(?:module|namespace)\s+['"]?([\w.]+)/g;
    const accessRe = /\b([A-Z]\w*)(?:\.\w+){1,}/g;
    let m: RegExpExecArray | null;
    while ((m = declRe.exec(content)) !== null) {
      const ns = m[1];
      if (!results[ns]) results[ns] = { declarationCount: 0, accessCount: 0, augmentationCount: 0 };
      results[ns].declarationCount++;
    }
    while ((m = augRe.exec(content)) !== null) {
      const ns = m[1].split(".")[0];
      if (!results[ns]) results[ns] = { declarationCount: 0, accessCount: 0, augmentationCount: 0 };
      results[ns].augmentationCount++;
    }
    while ((m = accessRe.exec(content)) !== null) {
      const ns = m[1];
      if (results[ns]) results[ns].accessCount++;
    }
    return results;
  },
});

// Agent role: Report TypeScript namespace declarations and access patterns across all source files.
const tsNamespaceUsageReporter = agent({
  model: "small",
  instructions: p`Scan TypeScript files: ${p.glob("src/**/*.ts")}.
For each file path, call scanNamespaces to detect namespace usages.
Aggregate results across all files and identify the most used namespace.
Return the declared output.`,
  output: s.object({
    namespaces: s.record(s.object({
      declarationCount: s.int,
      accessCount: s.int,
      augmentationCount: s.int,
    })),
    totalFiles: s.int,
    mostUsedNamespace: s.optional(s.string),
  }),
  tools: [scanNamespaces],
  addons: [repair()],
});

export default tsNamespaceUsageReporter;
```
