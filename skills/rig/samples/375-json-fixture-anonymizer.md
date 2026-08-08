# 375 - JSON Fixture Anonymizer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const anonymizeValue = defineTool("anonymizeValue", {
  description: "Anonymize a value based on field name heuristics.",
  parameters: s.object({ fieldName: s.string, value: s.string }),
  handler({ fieldName, value }) {
    const name = fieldName.toLowerCase();
    if (/email|mail/.test(name)) return "anonymized@example.com";
    if (/password|secret|token|key|auth/.test(name)) return "***REDACTED***";
    if (/name|user|first|last/.test(name)) return "Anonymous";
    if (/phone|mobile|tel/.test(name)) return "+1-000-000-0000";
    if (/address|street|city|zip|postal/.test(name)) return "123 Redacted St";
    if (/ssn|id|number/.test(name)) return "XXX-XX-XXXX";
    return value;
  },
});

// Agent role: anonymize sensitive fields in a JSON fixture file.
const jsonFixtureAnonymizer = agent({
  model: "small",
  input: s.object({
    inputFile: s.path,
    outputFile: s.path,
    fieldsToAnonymize: s.array(s.string),
  }),
  instructions: p`Anonymize sensitive fields in the JSON fixture file.

Input file contents:
${p.readInput("inputFile")}

For each field listed in input.fieldsToAnonymize, call anonymizeValue with the field name and its value.
Also apply anonymization heuristics to any other fields with sensitive-sounding names (email, password, token, name, etc.).
Write the anonymized JSON to the "result" output field.
Return fieldsAnonymized (count of fields changed), totalRecords (if array: length; if object: 1),
outputPath (same as input.outputFile), anonymizedFields (list of field names that were changed).`,
  tools: [anonymizeValue],
  output: s.object({
    fieldsAnonymized: s.int,
    totalRecords: s.int,
    outputPath: s.path,
    anonymizedFields: s.array(s.string),
    result: s.string,
  }),
  maxTurns: 4,
  addons: repair(),
});

export default jsonFixtureAnonymizer;

```
