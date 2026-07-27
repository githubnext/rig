# 200 - Npm Audit Simplifier

```rig
import { agent, p, s, repair } from "rig";

// Agent role: run npm audit and produce a simplified grouped vulnerability report with remediation advice.
const npmAuditSimplifierV2 = agent({
  model: "small",
  instructions: p`Run ${p.bash("npm audit --json 2>/dev/null || echo '{}'")} to get the vulnerability report. Parse the JSON output: extract each vulnerability's package name and severity (critical, high, moderate, low, info). Group package names by severity level into the vulnerabilitiesByLevel map. Count all vulnerabilities for totalCount. Write a one-sentence recommendation.`,
  output: s.object({
    vulnerabilitiesByLevel: s.record(s.array(s.string)),
    totalCount: s.number,
    recommendation: s.string,
  }),
  maxTurns: 5,
  addons: repair(),
});

export default npmAuditSimplifierV2;
```
