# 414 - Graphql Schema Type Extractor

```rig
import { agent, defineTool, p, s } from "rig";
import { steering } from "rig";

const extractGraphqlTypes = defineTool("extractGraphqlTypes", {
  description: "Extract type declarations from a GraphQL schema file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const pattern = /^(type|input|enum|interface|union)\s+(\w+)[^{]*\{([^}]*)\}/gm;
    const results: Record<string, { kind: string; fieldCount: number; fields: string[]; sourceFile: string }> = {};
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const kind = match[1];
      const name = match[2];
      const body = match[3];
      const fields = body.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0 && !l.startsWith("#"));
      results[name] = { kind, fieldCount: fields.length, fields, sourceFile: filePath };
    }
    return results;
  },
});

// Agent role: discover and extract all GraphQL type declarations across .graphql files.
const graphqlSchemaTypeExtractor = agent({
  model: "small",
  instructions: p`Extract GraphQL type declarations from .graphql files.

Files found:
${p.bash("find . -name '*.graphql' -not -path '*/node_modules/*' 2>/dev/null || echo '(none)'")}

For each .graphql file found, call extractGraphqlTypes with the file path. Merge all results into a single record keyed by type name.`,
  output: s.record(s.object({
    kind: s.enum("type", "input", "enum", "interface", "union"),
    fieldCount: s.number,
    fields: s.array(s.string),
    sourceFile: s.string,
  })),
  tools: [extractGraphqlTypes],
  addons: [steering()],
});

export default graphqlSchemaTypeExtractor;
```
