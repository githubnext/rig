# 396 - JSON Schema Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: validate a JSON data file against a JSON schema file, reporting
// which required fields are present and any validation errors.
const jsonSchemaValidator = agent({
  model: "small",
  input: s.object({ schemaFile: s.string, dataFile: s.string }),
  instructions: p`Read both files and validate the data against the schema.
Schema file: ${p.readInput("schemaFile")}
Data file: ${p.readInput("dataFile")}
Call validateStructure with the parsed contents and return the declared output.`,
  tools: [
    defineTool("validateStructure", {
      description: "Validate a JSON data object against a JSON schema's required fields and types",
      parameters: s.object({ schemaJson: s.string, dataJson: s.string }),
      handler({ schemaJson, dataJson }) {
        const errors: string[] = [];
        let schema: { required?: string[]; properties?: Record<string, { type?: string }>; title?: string };
        let data: Record<string, unknown>;
        try { schema = JSON.parse(schemaJson); } catch { return { valid: false, errors: ["Invalid schema JSON"], checkedFields: 0, schemaTitle: null }; }
        try { data = JSON.parse(dataJson); } catch { return { valid: false, errors: ["Invalid data JSON"], checkedFields: 0, schemaTitle: null }; }
        const required = schema.required ?? [];
        const properties = schema.properties ?? {};
        for (const field of required) {
          if (!(field in data)) errors.push(`Missing required field: ${field}`);
          else if (properties[field]?.type && typeof data[field] !== properties[field].type) {
            errors.push(`Field "${field}" expected type "${properties[field].type}", got "${typeof data[field]}"`);
          }
        }
        return {
          valid: errors.length === 0,
          errors,
          checkedFields: required.length,
          schemaTitle: schema.title ?? null,
        };
      },
    }),
  ],
  output: s.object({
    valid: s.boolean,
    errors: s.array(s.string),
    checkedFields: s.int,
    schemaTitle: s.optional(s.string),
  }),
  addons: [repair()],
});

export default jsonSchemaValidator;
```
