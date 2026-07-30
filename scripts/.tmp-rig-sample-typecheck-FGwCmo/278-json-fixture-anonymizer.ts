import { agent, p, s, defineTool } from "rig";

const anonymizeValue = defineTool("anonymizeValue", {
  description: "Return an anonymized replacement for a field value based on its name and type.",
  parameters: s.object({ fieldName: s.string, value: s.unknown, fieldType: s.string }),
  handler({ fieldName, fieldType }) {
    const name = fieldName.toLowerCase();
    if (name.includes("email")) return "[email@example.com]";
    if (name.includes("phone") || name.includes("tel")) return "[000-000-0000]";
    if (name.includes("name") || name.includes("user")) return "[REDACTED_NAME]";
    if (name.includes("address") || name.includes("street")) return "[REDACTED_ADDRESS]";
    if (name.includes("ip")) return "0.0.0.0";
    if (fieldType === "number") return 0;
    if (fieldType === "boolean") return false;
    return "[REDACTED]";
  },
});

// Agent role: anonymize sensitive fields in a JSON fixture file.
const jsonFixtureAnonymizer = agent({
  model: "typecheck",
  input: s.object({
    inputFile: s.path,
    outputFile: s.path,
    fieldsToAnonymize: s.array(s.string),
  }),
  instructions: p`Anonymize sensitive fields in a JSON fixture file.

Input file content:
${p.readInput("inputFile")}

For each field name in input.fieldsToAnonymize, call anonymizeValue with the field name, 
current value, and value type to get the replacement.
Replace all matching field values throughout the JSON structure.
Write the anonymized JSON to input.outputFile.
Count fieldsAnonymized (total replacements made) and totalRecords (array length or 1 for object).`,
  tools: [anonymizeValue],
  output: s.object({
    fieldsAnonymized: s.int,
    totalRecords: s.int,
    outputPath: s.path,
    anonymizedFields: s.array(s.string),
  }),
});

export default jsonFixtureAnonymizer;
