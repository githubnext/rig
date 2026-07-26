# 66 - CI Workflow Health Analyzer

```rig
import { agent, defineTool, p, s } from "rig";

const parseYamlSteps = defineTool("parse_yaml_steps", {
  description: "Extract step names and uses from a YAML workflow file.",
  parameters: s.object({ path: s.nonEmptyString }),
  handler: async ({ path }) => {
    const { readFileSync } = await import("node:fs");
    try {
      const content = readFileSync(path, "utf8");
      const steps = [...content.matchAll(/^\s+-\s+(?:name|uses):\s+(.+)$/gm)].map((m) => m[1]);
      return JSON.stringify(steps);
    } catch { return "[]"; }
  },
});

// Agent role: analyze CI workflow files and return a list of health issues.
const ciWorkflowAnalyzer = agent({
  model: "mini",
  maxTurns: 3,
  instructions: p`Scan ${p.glob(".github/workflows/*.yml")} and ${p.bashRaw`find .github/workflows -name '*.yaml' 2>/dev/null`} for workflow health issues. Use parse_yaml_steps to inspect individual files.`,
  output: s.object({
    issues: s.array(s.object({ workflow: s.nonEmptyString, severity: s.enum("info", "warning", "error"), message: s.string, fix: s.optional(s.string) })),
    healthy: s.boolean,
  }),
  tools: [parseYamlSteps],
});

export default ciWorkflowAnalyzer;
```
