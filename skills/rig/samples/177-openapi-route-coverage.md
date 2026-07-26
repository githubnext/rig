# 177 - OpenAPI Route Coverage

```rig
import { agent, p, s } from "rig";
import { defineTool } from "rig";

const extractRoutes = defineTool("extractRoutes", {
  description: "Parse grep output lines to extract route method and path from Express-style code",
  parameters: s.object({ grepLine: s.string }),
  handler({ grepLine }) {
    const match = grepLine.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/i)
      ?? grepLine.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/i);
    if (!match) return null;
    return { method: match[1].toUpperCase(), path: match[2] };
  },
});

// Agent role: compare OpenAPI spec routes with Express route handler implementations.
const openapiRouteCoverage = agent({
  model: "small",
  tools: [extractRoutes],
  instructions: p`Read the OpenAPI spec: ${p.readOptional("openapi.json", "{}")}. Also check ${p.readOptional("openapi.yaml", "")}. Scan source for route handlers: ${p.bash("grep -rn 'app\\.get\\|app\\.post\\|app\\.put\\|app\\.delete\\|router\\.' --include='*.ts' --include='*.js' . 2>/dev/null | grep -v node_modules | head -50")}. Use the extractRoutes tool to parse each grep line. Compare defined routes (from spec) vs implemented routes (from grep). Mark each as "implemented", "missing", or "extra". Compute coveragePercent.`,
  output: s.object({
    routes: s.array(s.object({
      path: s.string,
      method: s.enum("GET", "POST", "PUT", "DELETE", "PATCH"),
      status: s.enum("implemented", "missing", "extra"),
    })),
    coveragePercent: s.number,
    totalDefined: s.int,
    totalImplemented: s.int,
  }),
});

export default openapiRouteCoverage;
```
