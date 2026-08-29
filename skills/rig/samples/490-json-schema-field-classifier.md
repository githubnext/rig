# 490 - JSON Schema Field Classifier

```rig
import { agent, defineTool, p, repair, s } from "rig";

const classifySchemaFields = defineTool("classifySchemaFields", {
  description: "Parse a JSON schema file and classify each top-level property by its JSON Schema type.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { readFile } = await import("node:fs/promises");
    let schema: Record<string, unknown>;
    try {
      schema = JSON.parse(await readFile(filePath, "utf-8"));
    } catch {
      return { fieldCount: 0, fields: {} };
    }
    const properties = (schema["properties"] ?? {}) as Record<string, { type?: string | string[] }>;
    const fields: Record<string, string> = {};
    for (const [key, def] of Object.entries(properties)) {
      const t = def?.type;
      if (!t) fields[key] = "unknown";
      else if (Array.isArray(t)) fields[key] = t.length > 1 ? "mixed" : (t[0] ?? "unknown");
      else fields[key] = t;
    }
    return { fieldCount: Object.keys(fields).length, fields };
  },
});

// Agent role: discover JSON schema files and classify each field by its type.
const jsonSchemaFieldClassifier = agent({
  model: "small",
  instructions: p`Find JSON schema files using ${p.glob("**/*.schema.json")}. For each file path, call classifySchemaFields. Return schemas as a record keyed by file path with fieldCount and fields (a record mapping field name to type string). Include totalSchemas, totalFields, and mostComplexSchema (path with highest fieldCount, omit if no schemas found).`,
  output: s.object({
    schemas: s.record(s.object({
      fieldCount: s.int,
      fields: s.record(s.string),
    })),
    totalSchemas: s.int,
    totalFields: s.int,
    mostComplexSchema: s.optional(s.string),
  }),
  tools: [classifySchemaFields],
  maxTurns: 8,
  addons: [repair()],
});

export default jsonSchemaFieldClassifier;
```
