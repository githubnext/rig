# 345 - NPM Audit Simplifier

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyVuln = defineTool("classifyVuln", {
  description: "Classify an npm vulnerability as direct or transitive and produce a recommendation",
  parameters: s.object({
    name: s.string,
    severity: s.string,
    isDirect: s.boolean,
  }),
  handler({ name, severity, isDirect }) {
    const sev = severity.toLowerCase();
    const scope = isDirect ? "direct" : "transitive";
    const recommendation =
      sev === "critical" ? `Upgrade ${name} immediately (${scope} dependency)` :
      sev === "high" ? `Schedule upgrade for ${name} (${scope} dependency)` :
      isDirect ? `Review ${name} — ${sev} severity direct dependency` :
      `Monitor ${name} — ${sev} severity transitive dependency`;
    return { scope, recommendation };
  },
});

// Agent role: simplify npm audit output into an actionable vulnerability summary.
const npmAuditSimplifier = agent({
  model: "small",
  instructions: p`npm audit output: ${p.bash("npm audit --json 2>/dev/null || echo '{\"vulnerabilities\":{}}'")
}

Parse the audit JSON. For each vulnerability, call classifyVuln with its name, severity, and whether it is a direct dependency. Count criticalCount and highCount. Choose action: urgent if any critical, scheduled if any high, monitor if any moderate/low, none if no vulnerabilities. Write a one-line summary.`,
  output: s.object({
    vulnerabilities: s.array(s.object({
      name: s.string,
      severity: s.string,
      isDirect: s.boolean,
      recommendation: s.string,
    })),
    criticalCount: s.int,
    highCount: s.int,
    summary: s.string,
    action: s.enum("urgent", "scheduled", "monitor", "none"),
  }),
  tools: [classifyVuln],
  addons: [repair()],
  maxTurns: 4,
});

export default npmAuditSimplifier;
```
