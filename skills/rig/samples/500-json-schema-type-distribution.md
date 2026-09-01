# 500 - Json Schema Type Distribution

```rig
import { agent, defineTool, p, s } from "rig";

const analyzeSchemaTypes = defineTool("analyzeSchemaTypes", {
  description: "Analyze a JSON schema file and count property types",
  parameters: s.object({ schemaFile: s.path, content: s.string }),
  handler({ content }) {
    try {
      const schema = JSON.parse(content);
      const props = schema.properties ?? {};
      const typeCounts: Record<string, number> = {};
      for (const v of Object.values(props) as Array<{ type?: string }>) {
        const t = v.type ?? "unknown";
        typeCounts[t] = (typeCounts[t] ?? 0) + 1;
      }
      return { propertyCount: Object.keys(props).length, typeCounts };
    } catch {
      return { propertyCount: 0, typeCounts: {} };
    }
  },
});

// Agent role: discover JSON schema files and compute the distribution of property types across all schemas.
const jsonSchemaTypeDistribution = agent({
  model: "small",
  instructions: p`Find JSON schema files with ${p.glob("**/*.schema.json")} and also using ${p.bash("find . -name '*.schema.json' -not -path '*/node_modules/*' 2>/dev/null | head -10 || true")}. Read and analyze each file using analyzeSchemaTypes. Aggregate property type counts across all schemas. Return the type distribution and most common type.`,
  output: s.object({
    schemaFiles: s.array(s.path),
    totalProperties: s.int,
    typeDistribution: s.record(s.int),
    mostCommonType: s.string,
  }),
  tools: [analyzeSchemaTypes],
});

export default jsonSchemaTypeDistribution;
```
