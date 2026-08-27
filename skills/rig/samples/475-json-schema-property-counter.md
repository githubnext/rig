# 475 - JSON Schema Property Counter

```rig
import { agent, defineTool, p, repair, s } from "rig";

const countPropertiesAtLevel = defineTool("countPropertiesAtLevel", {
  description: "Recursively count JSON Schema properties at each depth level.",
  parameters: s.object({ schemaJson: s.string }),
  handler: async ({ schemaJson }) => {
    const schema = JSON.parse(schemaJson);
    const levels: Record<string, number> = {};
    let total = 0;
    let maxDepth = 0;
    let hasRequired = false;

    function walk(node: unknown, depth: number): void {
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      if (obj["required"]) hasRequired = true;
      if (obj["properties"] && typeof obj["properties"] === "object") {
        const props = obj["properties"] as Record<string, unknown>;
        const count = Object.keys(props).length;
        levels[String(depth)] = (levels[String(depth)] ?? 0) + count;
        total += count;
        if (depth > maxDepth) maxDepth = depth;
        for (const val of Object.values(props)) walk(val, depth + 1);
      }
      if (obj["items"]) walk(obj["items"], depth);
    }

    walk(schema, 0);
    return { levels, totalProperties: total, maxDepth, hasRequired };
  },
});

// Agent role: count JSON schema properties at each nesting depth given a schema file path.
const jsonSchemaPropertyCounter = agent({
  model: "small",
  input: s.object({ schemaFile: s.string }),
  instructions: p`Read the JSON schema file at the path provided in input.schemaFile: ${p.readInput("schemaFile")}. Pass its full content to countPropertiesAtLevel. Return levels (depth->count), totalProperties, maxDepth, and hasRequired.`,
  output: s.object({
    levels: s.record(s.int),
    totalProperties: s.int,
    maxDepth: s.int,
    hasRequired: s.boolean,
  }),
  tools: [countPropertiesAtLevel],
  maxTurns: 4,
  addons: repair(),
});

export default jsonSchemaPropertyCounter;
```
