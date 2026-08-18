# json-union-type-inferrer - JSON Union Type Inferrer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const inferFieldType = defineTool("inferFieldType", {
  description: "Infer the TypeScript-compatible type of a field from its observed values.",
  parameters: s.object({
    fieldName: s.string,
    values: s.array(s.unknown),
  }),
  handler: async ({ values }) => {
    const types = new Set<string>();
    let nullable = false;
    const uniqueValues = new Set<string>();
    for (const v of values) {
      if (v === null) { nullable = true; continue; }
      uniqueValues.add(JSON.stringify(v));
      if (Array.isArray(v)) types.add("array");
      else types.add(typeof v === "object" ? "object" : typeof v);
    }
    const typeList = [...types];
    let inferredType: "string" | "number" | "boolean" | "null" | "array" | "object" | "mixed";
    if (typeList.length === 0) inferredType = "null";
    else if (typeList.length === 1) inferredType = typeList[0] as typeof inferredType;
    else inferredType = "mixed";
    return { inferredType, nullable, uniqueValues: uniqueValues.size };
  },
});

// Agent role: analyze a JSON file containing an array of objects and infer field types.
const jsonUnionTypeInferrer = agent({
  model: "small",
  input: s.object({ jsonFile: s.string }),
  output: s.object({
    fields: s.record(s.object({
      type: s.enum("string", "number", "boolean", "null", "array", "object", "mixed"),
      nullable: s.boolean,
      uniqueValues: s.int,
    })),
    totalFields: s.int,
    mixedTypeCount: s.int,
  }),
  instructions: p`Read the JSON file at ${p.readInput("jsonFile")}. Parse it as an array of objects. For each field key, collect all its values across objects and call inferFieldType. Return a fields record keyed by field name, totalFields, and mixedTypeCount (number of fields with type "mixed").`,
  tools: [inferFieldType],
  addons: [repair()],
});

export default jsonUnionTypeInferrer;
```
