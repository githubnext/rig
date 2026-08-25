# 462 - TypeScript Const Enum Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";


const extractConstEnums = defineTool("extractConstEnums", {
  description: "Read a TypeScript file and extract all const enum declarations with their members.",
  parameters: s.object({ filePath: s.path("TypeScript file path") }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(filePath, "utf8");
    const enumRe = /const\s+enum\s+(\w+)\s*\{([^}]*)\}/g;
    const result: Record<string, { name: string; value: string | null }[]> = {};
    let m: RegExpExecArray | null;
    while ((m = enumRe.exec(src)) !== null) {
      const enumName = m[1];
      const body = m[2];
      const members = body
        .split(",")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => {
          const [name, value] = line.split("=").map((s: string) => s.trim());
          return { name, value: value ?? null };
        });
      result[enumName] = members;
    }
    return JSON.stringify(result);
  },
});

// Agent role: find and extract all TypeScript const enum declarations across the workspace.
const tsConstEnumExtractor = agent({
  name: "tsConstEnumExtractor",
  model: "small",
  instructions: p`Scan all TypeScript source files for const enum declarations.
Files: ${p.glob("src/**/*.ts")}
Use extractConstEnums on each file. Aggregate results: enums record (members array, memberCount, sourceFile), totalEnums, totalMembers, largestEnum (name with most members, if any).`,
  output: s.object({
    enums: s.record(s.object({
      members: s.array(s.object({ name: s.string, value: s.optional(s.string) })),
      memberCount: s.int,
      sourceFile: s.path,
    })),
    totalEnums: s.int,
    totalMembers: s.int,
    largestEnum: s.optional(s.string),
  }),
  tools: [extractConstEnums],
  addons: [steering()],
});

export default tsConstEnumExtractor;
```
