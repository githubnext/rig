# 419 - JSON Schema Property Counter

```rig
import { agent, p, s, repair, defineTool } from "rig";

const countPropertiesAtLevel = defineTool("countPropertiesAtLevel", {
  description: "Count properties at each nesting depth in a JSON schema object.",
  parameters: s.object({ schemaJson: s.string }),
  handler: ({ schemaJson }: { schemaJson: string }) => {
    const levelCounts: Record<string, number> = {};
    let maxDepth = 0;
    let totalProperties = 0;
    let hasRequired = false;
    function walk(node: Record<string, unknown>, depth: number): void {
      if (depth > maxDepth) maxDepth = depth;
      const props = node["properties"] as Record<string, unknown> | undefined;
      if (props) {
        const key = `level_${depth}`;
        const count = Object.keys(props).length;
        levelCounts[key] = (levelCounts[key] ?? 0) + count;
        totalProperties += count;
        for (const child of Object.values(props)) {
          walk(child as Record<string, unknown>, depth + 1);
        }
      }
      if (node["required"]) hasRequired = true;
      const defs = node["$defs"] ?? node["definitions"];
      if (defs && typeof defs === "object") {
        for (const child of Object.values(defs as Record<string, unknown>)) {
          walk(child as Record<string, unknown>, depth);
        }
      }
    }
    try {
      walk(JSON.parse(schemaJson) as Record<string, unknown>, 0);
    } catch {
      // ignore
    }
    return { levelCounts, totalProperties, maxDepth, hasRequired };
  },
});

// Agent role: Read a JSON schema file and count properties at each nesting level.
const jsonSchemaPropertyCounter = agent({
  model: "small",
  input: s.object({ schemaFile: s.string }),
  instructions: p`Schema file content:
${p.readInput("schemaFile")}

Call the countPropertiesAtLevel tool with the schema content as JSON. Return levels (keyed by level_N), totalProperties, maxDepth, and hasRequired.`,
  tools: [countPropertiesAtLevel],
  output: s.object({
    levels: s.record(s.int),
    totalProperties: s.int,
    maxDepth: s.int,
    hasRequired: s.boolean,
  }),
  addons: [repair()],
});

export default jsonSchemaPropertyCounter;

```
