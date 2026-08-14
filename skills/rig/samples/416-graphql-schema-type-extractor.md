# 416 - GraphQL Schema Type Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractGraphqlTypes = defineTool("extractGraphqlTypes", {
  description: "Extract type declarations from a GraphQL schema file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const results: Array<{ name: string; kind: string; fieldCount: number; fields: string[]; sourceFile: string }> = [];
    const re = /^(type|input|enum|interface|union)\s+(\w+)[^{]*\{([^}]*)\}/gm;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const kind = match[1];
      const name = match[2];
      const body = match[3];
      const fields = body.split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0 && !l.startsWith("#"));
      results.push({ name, kind, fieldCount: fields.length, fields, sourceFile: filePath });
    }
    return results;
  },
});

// Agent role: Extract and catalog all type declarations from GraphQL schema files in the workspace.
const graphqlSchemaTypeExtractor = agent({
  model: "small",
  instructions: p`Extract all GraphQL type declarations from schema files.
Schema files: ${p.bash("find . -name '*.graphql' -not -path '*/node_modules/*'")}
Use extractGraphqlTypes on each file path.
Aggregate all results into a single record keyed by type name.
Each entry should have: kind (type/input/enum/interface/union), fieldCount, fields (array), sourceFile.`,
  output: s.record(s.object({
    kind: s.enum("type", "input", "enum", "interface", "union"),
    fieldCount: s.int,
    fields: s.array(s.string),
    sourceFile: s.string,
  })),
  tools: [extractGraphqlTypes],
  addons: [steering()],
});

export default graphqlSchemaTypeExtractor;
```
