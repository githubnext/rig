# 86 - Npm Audit Simplifier

```rig
import { agent, p, s } from "rig";
import { repair } from "rig/addons";

// Agent role: run npm audit, parse the JSON output, and produce a simplified vulnerability report.
const npmAuditSimplifier = agent({
  model: "small",
  instructions: p`Run ${p.bash("npm audit --json 2>/dev/null || echo '{}'")} to get the vulnerability report. Parse the JSON and group vulnerabilities by severity level (critical, high, moderate, low, info). Count the total number of vulnerabilities. Provide a one-sentence recommendation for remediation.`,
  output: s.object({
    vulnerabilitiesByLevel: s.record(s.array(s.string)),
    totalCount: s.number,
    recommendation: s.string,
  }),
  maxTurns: 5,
  addons: repair(),
});

export default npmAuditSimplifier;
```
