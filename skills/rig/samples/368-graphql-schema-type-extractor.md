# 368 - GraphQL Schema Type Extractor

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";

const extractGraphqlTypes = defineTool("extractGraphqlTypes", {
  description: "Extract type declarations from a GraphQL schema file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf8");
      const typeRegex = /(type|input|enum|interface|union)\s+(\w+)[^{]*\{([^}]*)\}/g;
      const types: Array<{ name: string; kind: string; fields: string[] }> = [];
      let match;
      while ((match = typeRegex.exec(content)) !== null) {
        const kind = match[1];
        const name = match[2];
        const body = match[3];
        const fields = body.match(/^\s+(\w+)\s*[:(]/gm)?.map((f: string) => f.trim().split(/\s|:/)[0]) ?? [];
        types.push({ name, kind, fields });
      }
      return { types };
    } catch {
      return { types: [] };
    }
  },
});

// Agent role: extract all type declarations from GraphQL schema files in the workspace.
const graphqlSchemaTypeExtractor = agent({
  model: "small",
  instructions: p`Extract all type declarations from GraphQL schema files.

GraphQL files found:
${p.bash("find . -name '*.graphql' -not -path '*/node_modules/*' 2>/dev/null || echo ''")}

Steps:
1. For each .graphql file, call extractGraphqlTypes.
2. For each type returned, add an entry to the output record keyed by type name with kind, fieldCount (fields.length), fields, and sourceFile (the filePath).
3. If a name appears in multiple files, prefer the last occurrence.`,
  output: s.record(s.object({
    kind: s.enum("type", "input", "enum", "interface", "union"),
    fieldCount: s.number,
    fields: s.array(s.string),
    sourceFile: s.string,
  })),
  tools: [extractGraphqlTypes],
  maxTurns: 6,
});

export default graphqlSchemaTypeExtractor;
```
