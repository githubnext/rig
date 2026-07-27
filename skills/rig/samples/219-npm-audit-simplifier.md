# 219 - Npm Audit Simplifier

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyVuln = defineTool("classifyVuln", {
  description: "Classify a vulnerability as direct or transitive and produce a remediation recommendation",
  parameters: s.object({
    name: s.string,
    severity: s.string,
    isDirect: s.boolean,
  }),
  handler({ name, severity, isDirect }) {
    const rec = isDirect
      ? `Update ${name} directly in package.json`
      : `Update the top-level package that depends on ${name}`;
    return { recommendation: rec + (severity === "critical" || severity === "high" ? " immediately" : " when convenient") };
  },
});

// Agent role: run npm audit and produce a simplified, actionable vulnerability report.
const npmAuditSimplifier = agent({
  model: "small",
  instructions: p`Run npm audit and capture results: ${p.bash("npm audit --json 2>/dev/null || echo '{\"vulnerabilities\":{}}'") }. Parse the JSON output. For each vulnerability entry, extract name and severity, determine if it is direct (no via chain or via is the package itself), and use the classifyVuln tool to get a recommendation. Count criticalCount and highCount separately. Write a one-sentence summary. Set action to urgent if criticalCount > 0, scheduled if highCount > 0, monitor if there are any other vulns, or none if clean.`,
  output: s.object({
    vulnerabilities: s.array(s.object({
      name: s.string,
      severity: s.enum("critical", "high", "moderate", "low", "info"),
      isDirect: s.boolean,
      recommendation: s.string,
    })),
    criticalCount: s.int,
    highCount: s.int,
    summary: s.string,
    action: s.enum("urgent", "scheduled", "monitor", "none"),
  }),
  tools: [classifyVuln],
  maxTurns: 5,
  addons: repair(),
});

export default npmAuditSimplifier;
```
