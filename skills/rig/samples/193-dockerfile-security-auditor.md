# 193 - Dockerfile Security Auditor

```rig
import { agent, p, s, defineTool } from "rig";

const auditPatterns = defineTool("auditPatterns", {
  description: "Check a Dockerfile line for known insecure patterns",
  parameters: s.object({ line: s.string, lineNumber: s.int }),
  handler({ line, lineNumber }) {
    const findings: Array<{ severity: string; pattern: string; suggestion: string }> = [];
    if (/^USER\s+root\s*$/i.test(line.trim())) {
      findings.push({ severity: "critical", pattern: "root USER", suggestion: "Use a non-root user" });
    }
    if (/^ADD\s+/.test(line) && !/ADD\s+https?:\/\//.test(line)) {
      findings.push({ severity: "medium", pattern: "ADD for local files", suggestion: "Use COPY instead of ADD" });
    }
    if (/:latest/.test(line)) {
      findings.push({ severity: "high", pattern: ":latest tag", suggestion: "Pin to a specific image version" });
    }
    if (/ENV\s+\w*(SECRET|PASSWORD|TOKEN|KEY)\w*\s*=/.test(line)) {
      findings.push({ severity: "critical", pattern: "secret in ENV", suggestion: "Use build args or secrets" });
    }
    return { lineNumber, findings };
  },
});

// Agent role: audit a Dockerfile for security anti-patterns and produce a severity-ranked findings report.
const dockerfileSecurityAuditor = agent({
  model: "small",
  input: s.object({ dockerfilePath: s.path }),
  instructions: p`Read the Dockerfile at ${p.readInput("dockerfilePath")}. Use auditPatterns on each instruction line to detect security issues. Compute an overall score from 0–100 (100 = no issues).`,
  output: s.object({
    findings: s.array(s.object({
      line: s.int,
      pattern: s.string,
      severity: s.enum("low", "medium", "high", "critical"),
      suggestion: s.string,
    })),
    passes: s.boolean,
    score: s.int,
  }),
  tools: [auditPatterns],
});

export default dockerfileSecurityAuditor;
```
