# 418 - TS Mapped Type Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: extract TypeScript mapped type declarations from source files.
const tsMappedTypeExtractor = agent({
  model: "small",
  instructions: p`Extract TypeScript mapped type declarations from source files.

TypeScript files: ${p.glob("src/**/*.ts")}

For each file, call extractMappedTypes. Then produce the declared output.`,
  tools: [
    defineTool("extractMappedTypes", {
      description: "Extract mapped type declarations from a TypeScript file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        try {
          const content = await readFile(filePath, "utf-8");
          const regex = /type\s+(\w+)\s*(?:<[^>]*>)?\s*=\s*\{[^}]*\[(\w+)\s+in\s+([^\]]+)\]\s*(?:(readonly)\s*)?:\s*([^;}\n]+)/g;
          const types: Array<{ name: string; keySource: string; valueType: string; isReadonly: boolean; sourceFile: string }> = [];
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            types.push({
              name: m[1],
              keySource: m[3].trim(),
              valueType: m[5].trim(),
              isReadonly: !!m[4],
              sourceFile: filePath,
            });
          }
          return types;
        } catch {
          return [];
        }
      },
    }),
  ],
  output: s.object({
    types: s.record(s.object({
      keySource: s.string,
      valueType: s.string,
      isReadonly: s.boolean,
      sourceFile: s.string,
    })),
    totalMappedTypes: s.int,
    totalFiles: s.int,
    mostUsedKeySource: s.optional(s.string),
  }),
  addons: [steering()],
});

export default tsMappedTypeExtractor;

```
