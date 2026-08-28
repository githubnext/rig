# 482 - TS Mapped Type Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";

const extractMappedTypes = defineTool("extractMappedTypes", {
  description: "Extract TypeScript mapped type patterns from a source file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    const pattern = /\{\s*\[(\w+)\s+in\s+([^\]]+)\]\s*(?::\s*([^;}\n]+))?/g;
    const results: Array<{ keySource: string; valueType: string; isReadonly: boolean; sourceFile: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      const before = content.slice(0, m.index);
      const isReadonly = /readonly\s*$/.test(before.trimEnd());
      results.push({
        keySource: m[2]?.trim() ?? "unknown",
        valueType: m[3]?.trim() ?? "unknown",
        isReadonly,
        sourceFile: filePath,
      });
    }
    return results;
  },
});

// Agent role: scan TypeScript source files for mapped type patterns and summarize usage.
const tsMappedTypeExtractor = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.glob("src/**/*.ts")}. For each file path, call extractMappedTypes. Build a types record keyed by a unique name (e.g., "FilePath:index") with keySource, valueType, isReadonly, sourceFile. Include totalMappedTypes, totalFiles, and mostUsedKeySource (the keySource string that appears most often, omit if no types found).`,
  output: s.object({
    types: s.record(s.object({
      keySource: s.string,
      valueType: s.string,
      isReadonly: s.boolean,
      sourceFile: s.path,
    })),
    totalMappedTypes: s.int,
    totalFiles: s.int,
    mostUsedKeySource: s.optional(s.string),
  }),
  tools: [extractMappedTypes],
  maxTurns: 8,
  addons: [steering()],
});

export default tsMappedTypeExtractor;
```
