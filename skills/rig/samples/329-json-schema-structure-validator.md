# 329 - JSON Schema Structure Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: validate a JSON data file against a JSON schema's structure, checking required fields and top-level types.
const jsonSchemaStructureValidator = agent({
  model: "small",
  input: s.object({ schemaFile: s.path, dataFile: s.path }),
  instructions: p`Validate a JSON data file against a JSON schema.
Schema: ${p.readInput("schemaFile")}
Data: ${p.readInput("dataFile")}
Use the validateStructure tool to check required fields and type conformance.
Return whether the data is valid, any errors found, and the number of fields checked.`,
  output: s.object({
    valid: s.boolean,
    errors: s.array(s.object({
      field: s.string,
      expected: s.string,
      actual: s.string,
    })),
    checkedFields: s.int,
    schemaTitle: s.optional(s.string),
  }),
  tools: [
    defineTool("validateStructure", {
      description: "Parse schema and data JSON strings and perform basic structural validation",
      parameters: s.object({ schema: s.string, data: s.string }),
      handler({ schema, data }) {
        const schemaObj = JSON.parse(schema) as Record<string, unknown>;
        const dataObj = JSON.parse(data) as Record<string, unknown>;
        const errors: Array<{ field: string; expected: string; actual: string }> = [];
        const required = (schemaObj["required"] as string[] | undefined) ?? [];
        const properties = (schemaObj["properties"] as Record<string, { type?: string }> | undefined) ?? {};
        for (const field of required) {
          if (!(field in dataObj)) {
            errors.push({ field, expected: "present", actual: "missing" });
          }
        }
        for (const [field, propSchema] of Object.entries(properties)) {
          if (field in dataObj && propSchema.type) {
            const actual = typeof dataObj[field];
            if (actual !== propSchema.type) {
              errors.push({ field, expected: propSchema.type, actual });
            }
          }
        }
        return {
          valid: errors.length === 0,
          errors,
          checkedFields: Object.keys(properties).length,
          schemaTitle: schemaObj["title"] as string | undefined,
        };
      },
    }),
  ],
  addons: [repair()],
});

export default jsonSchemaStructureValidator;
```
