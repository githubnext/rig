# 371 - Json Fixture Anonymizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const anonymizeValue = defineTool("anonymizeValue", {
  description: "Anonymize a field value based on the field name.",
  parameters: s.object({ fieldName: s.string, value: s.string }),
  handler({ fieldName, value }) {
    const lower = fieldName.toLowerCase();
    if (lower.includes("email")) return "redacted@example.com" as const;
    if (lower.includes("name")) return "John Doe" as const;
    if (lower.includes("phone")) return "XXX-XXXX" as const;
    if (lower.includes("id")) return String(Math.abs(value.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)));
    return "REDACTED" as const;
  },
});

// Agent role: Read a JSON fixture file, anonymize specified fields, and write sanitized output.
const jsonFixtureAnonymizer = agent({
  model: "small",
  input: s.object({ inputFile: s.path, outputFile: s.path, fieldsToAnonymize: s.array(s.string) }),
  instructions: p`Read ${p.readInput("inputFile")}, anonymize the fields listed in fieldsToAnonymize using the anonymizeValue tool, then write the sanitized JSON to ${p.writeInput("outputFile", "anonymizedContent")}.`,
  output: s.object({
    fieldsAnonymized: s.int,
    totalRecords: s.int,
    outputPath: s.path,
    anonymizedFields: s.array(s.string),
  }),
  tools: [anonymizeValue],
  addons: [repair()],
});

export default jsonFixtureAnonymizer;
```
