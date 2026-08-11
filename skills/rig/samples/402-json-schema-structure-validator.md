# 402 - Json Schema Structure Validator

```rig
import { agent, p, s, repair, defineTool } from "rig";

const validateStructure = defineTool("validateStructure", {
  description: "Validate a JSON data file against a JSON schema file, checking required fields and types.",
  parameters: s.object({ schemaContent: s.string, dataContent: s.string }),
  handler: async ({ schemaContent, dataContent }: { schemaContent: string; dataContent: string }) => {
    const errors: string[] = [];
    let schema: Record<string, unknown>;
    let data: Record<string, unknown>;
    try {
      schema = JSON.parse(schemaContent) as Record<string, unknown>;
    } catch (e) {
      return { valid: false, errors: ["Invalid JSON in schema file"], checkedFields: 0, schemaTitle: undefined };
    }
    try {
      data = JSON.parse(dataContent) as Record<string, unknown>;
    } catch (e) {
      return { valid: false, errors: ["Invalid JSON in data file"], checkedFields: 0, schemaTitle: undefined };
    }
    const required = Array.isArray(schema["required"]) ? (schema["required"] as string[]) : [];
    const properties = (schema["properties"] ?? {}) as Record<string, { type?: string }>;
    let checkedFields = 0;
    for (const key of required) {
      checkedFields++;
      if (!(key in data)) {
        errors.push(`Missing required field: ${key}`);
      } else if (properties[key]?.type) {
        const expected = properties[key].type as string;
        const actual = Array.isArray(data[key]) ? "array" : typeof data[key];
        if (actual !== expected) {
          errors.push(`Field "${key}" expected type "${expected}" but got "${actual}"`);
        }
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      checkedFields,
      schemaTitle: typeof schema["title"] === "string" ? schema["title"] : undefined,
    };
  },
});

// Agent role: Validate a JSON data file against a JSON schema and report structural errors.
const jsonSchemaStructureValidator = agent({
  model: "small",
  input: s.object({ schemaFile: s.path, dataFile: s.path }),
  instructions: p`Schema file content:
${p.readInput("schemaFile")}

Data file content:
${p.readInput("dataFile")}

Use the validateStructure tool with both file contents to check required fields and types. Return the validation result.`,
  tools: [validateStructure],
  output: s.object({
    valid: s.boolean,
    errors: s.array(s.string),
    checkedFields: s.int,
    schemaTitle: s.optional(s.string),
  }),
  addons: [repair()],
});

export default jsonSchemaStructureValidator;
```
