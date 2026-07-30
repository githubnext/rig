import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: extract TypeScript enum declarations and their members from source files.
const tsEnumValueExtractor = agent({
  model: "typecheck",
  instructions: p`You are a TypeScript enum value extractor.

Find TypeScript files with enum declarations:
${p.bash("grep -rln 'enum ' --include='*.ts' . 2>/dev/null | head -20 || echo 'no enums found'")}

For each file found, call extractEnumValues with the file path to parse all enum declarations.
Return the declared output keyed by enum name.`,
  tools: [
    defineTool("extractEnumValues", {
      description: "Read a TypeScript file and extract all enum declarations with their members",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const result: Record<string, { members: string[]; isConst: boolean; memberCount: number }> = {};
        const enumRegex = /(const\s+)?enum\s+(\w+)\s*\{([^}]*)\}/gs;
        for (const match of content.matchAll(enumRegex)) {
          const isConst = !!match[1];
          const enumName = match[2];
          const body = match[3];
          const members = body
            .split(",")
            .map((m: string) => m.trim().split(/\s*=\s*/)[0].trim())
            .filter((m: string) => m.length > 0 && !m.startsWith("//"));
          result[enumName] = { members, isConst, memberCount: members.length };
        }
        return result;
      },
    }),
  ],
  output: s.record(s.object({
    members: s.array(s.string),
    isConst: s.boolean,
    memberCount: s.int,
  })),
  addons: [steering()],
});

export default tsEnumValueExtractor;
