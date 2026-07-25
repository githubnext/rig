# 85 - Dockerfile Security Audit

```rig
import { agent, p, s, defineTool } from "rig";

const checkSecurityPattern = defineTool("checkSecurityPattern", {
  description: "Check a Dockerfile line for known security anti-patterns",
  parameters: s.object({ line: s.string, lineNumber: s.number }),
  handler({ line, lineNumber }) {
    const findings: Array<{ severity: string; message: string; rule: string }> = [];
    if (/^USER\s+root\s*$/i.test(line.trim()) || /^RUN.*&&.*&&.*--no-check/.test(line)) {
      findings.push({ severity: "critical", message: "Running as root user", rule: "no-root-user" });
    }
    if (/ADD\s+/.test(line) && !/ADD\s+https?:\/\//.test(line)) {
      findings.push({ severity: "medium", message: "Prefer COPY over ADD for local files", rule: "prefer-copy" });
    }
    if (/FROM\s+\S+:latest/.test(line)) {
      findings.push({ severity: "high", message: "Avoid :latest tag for reproducibility", rule: "no-latest-tag" });
    }
    if (/ENV\s+\w*(KEY|SECRET|PASSWORD|TOKEN)\w*\s*=/.test(line)) {
      findings.push({ severity: "critical", message: "Secret embedded in ENV instruction", rule: "no-secrets-in-env" });
    }
    return { lineNumber, findings };
  },
});

// Agent role: audit a Dockerfile for security issues by scanning each instruction for known anti-patterns.
const dockerfileSecurityAudit = agent({
  model: "small",
  input: s.object({ dockerfilePath: s.path }),
  instructions: p`Read the Dockerfile at ${p.readInput("dockerfilePath")}. Use the checkSecurityPattern tool on each instruction line to detect security issues. Compile all findings with their severity, line number, rule, and message.`,
  output: s.object({
    findings: s.array(s.object({
      severity: s.enum("critical", "high", "medium", "low"),
      lineNumber: s.number,
      message: s.string,
      rule: s.string,
    })),
    passes: s.boolean,
  }),
  tools: [checkSecurityPattern],
});

export default dockerfileSecurityAudit;
```
