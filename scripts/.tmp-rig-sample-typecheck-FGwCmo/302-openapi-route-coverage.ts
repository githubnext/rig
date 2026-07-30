import { agent, p, s, defineTool, repair } from "rig";

const extractRoutes = defineTool("extractRoutes", {
  description: "Extract HTTP route patterns from router handler code",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const routes: Array<{ path: string; method: string }> = [];
    const pattern = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      routes.push({ method: (m[1] ?? "get").toUpperCase(), path: m[2] ?? "/" });
    }
    return routes;
  },
});

// Agent role: Compare OpenAPI spec routes against implemented router handlers to measure coverage.
const openapiRouteCoverage = agent({
  model: "typecheck",
  instructions: p`Compare OpenAPI spec routes against implemented router handlers to determine coverage.

OpenAPI spec:
${p.readOptional("openapi.json", "{}")}

Router handler code:
${p.bash("grep -rn 'router\\.' --include='*.ts' --include='*.js' . 2>/dev/null | head -50 || echo 'no routes'")}

Use the extractRoutes tool on the router handler code to discover implemented routes.
Cross-reference with paths defined in the OpenAPI spec.
Return routes array showing which are defined (in spec) vs implemented (in code).
Calculate coveragePercent as (totalImplemented / totalDefined * 100) or 0 if no spec.`,
  output: s.object({
    routes: s.array(s.object({
      path: s.string,
      method: s.string,
      defined: s.boolean,
      implemented: s.boolean,
    })),
    coveragePercent: s.number,
    totalDefined: s.int,
    totalImplemented: s.int,
  }),
  tools: [extractRoutes],
  addons: [repair()],
});

export default openapiRouteCoverage;
