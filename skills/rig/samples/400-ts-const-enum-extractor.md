# 400 - TypeScript Const Enum Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: scan TypeScript source files for const enum declarations and
// extract their member names and optional numeric values.
const tsConstEnumExtractor = agent({
  model: "small",
  instructions: p`Find all TypeScript const enum declarations in the workspace.
Source files: ${p.glob("src/**/*.ts")}
For each file call extractConstEnums to capture enum names and their members.
Return a record keyed by enum name.`,
  tools: [
    defineTool("extractConstEnums", {
      description: "Extract const enum declarations and their members from a TypeScript file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const enums: Array<{ name: string; members: Array<{ name: string; value: number | null }>; sourceFile: string }> = [];
        const enumRegex = /const\s+enum\s+(\w+)\s*\{([^}]*)\}/g;
        for (const m of content.matchAll(enumRegex)) {
          const name = m[1];
          const body = m[2];
          const members = body.split(",").map((entry: string) => {
            const [mname, mval] = entry.split("=").map((s: string) => s.trim());
            return { name: mname.replace(/\s+/g, ""), value: mval !== undefined ? parseInt(mval, 10) : null };
          }).filter((m: { name: string; value: number | null }) => m.name);
          enums.push({ name, members, sourceFile: filePath });
        }
        return enums;
      },
    }),
  ],
  output: s.object({
    enums: s.record(s.object({
      members: s.array(s.object({ name: s.string, value: s.optional(s.int) })),
      memberCount: s.int,
      sourceFile: s.string,
    })),
    totalEnums: s.int,
    totalMembers: s.int,
    largestEnum: s.optional(s.string),
  }),
  addons: [steering()],
});

export default tsConstEnumExtractor;
```
