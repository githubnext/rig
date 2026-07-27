# 197 - Ts Enum Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractEnumValues = defineTool("extractEnumValues", {
  description: "Extract all member names and values from a TypeScript enum in a source file",
  parameters: s.object({ filePath: s.string, enumName: s.string }),
  async handler({ filePath, enumName }) {
    const source = await readFile(filePath, "utf8");
    const constMatch = new RegExp(`(const\\s+)?enum\\s+${enumName}\\s*\\{([^}]*)\\}`, "s").exec(source);
    if (!constMatch) return { members: [], isConst: false, memberCount: 0 };
    const isConst = Boolean(constMatch[1]);
    const body = constMatch[2];
    const members = [...body.matchAll(/(\w+)\s*(?:=\s*([^,\n]+))?/g)].map((m) => ({
      name: m[1],
      value: m[2]?.trim() ?? undefined,
    }));
    return { members, isConst, memberCount: members.length };
  },
});

// Agent role: find all TypeScript enum declarations and extract their members and values.
const tsEnumExtractor = agent({
  model: "small",
  instructions: p`You are a TypeScript enum extractor.

Find TypeScript files with enum declarations:
${p.bash("grep -rn 'enum ' --include='*.ts' . 2>/dev/null | grep -v node_modules || true")}

For each unique (file, enumName) pair found, use the extractEnumValues tool.
Aggregate results into a record keyed by enum name (append "@filepath" if the same name appears in multiple files).`,
  tools: [extractEnumValues],
  addons: [steering({ message: "Ensure every file from the grep output is scanned before finalizing." })],
  output: s.record(s.object({
    members: s.array(s.object({ name: s.string, value: s.optional(s.string) })),
    isConst: s.boolean,
    memberCount: s.int,
  })),
});

export default tsEnumExtractor;
```
