import { agent, p, s, defineTool } from "rig";

const RULES = [
  { re: /^USER\s+root\s*$/im, sev: "critical", pattern: "root USER", suggestion: "Use a non-root user" },
  { re: /^ADD\s+(?!https?:\/\/)/m, sev: "medium", pattern: "ADD for local files", suggestion: "Use COPY instead of ADD" },
  { re: /:latest/, sev: "high", pattern: ":latest tag", suggestion: "Pin to a specific image version" },
  { re: /ENV\s+\w*(SECRET|PASSWORD|TOKEN|KEY)\w*\s*=/, sev: "critical", pattern: "secret in ENV", suggestion: "Use build args or secrets" },
];
const auditPatterns = defineTool("auditPatterns", {
  description: "Check a Dockerfile line for known insecure patterns",
  parameters: s.object({ line: s.string, lineNumber: s.int }),
  handler: ({ line, lineNumber }) => ({
    lineNumber,
    findings: RULES.filter(r => r.re.test(line)).map(({ sev: severity, pattern, suggestion }) => ({ severity, pattern, suggestion })),
  }),
});
// Agent role: audit a Dockerfile for security anti-patterns and produce a severity-ranked findings report.
const dockerfileSecurityAuditor = agent({
  model: "typecheck",
  instructions: p`Read the Dockerfile: ${p.readOptional("Dockerfile", "# no Dockerfile")}. Use auditPatterns on each instruction line to detect security issues. Compute an overall score from 0–100 (100 = no issues).`,
  output: s.object({
    findings: s.array(s.object({ line: s.int, pattern: s.string, severity: s.enum("low", "medium", "high", "critical"), suggestion: s.string })),
    passes: s.boolean,
    score: s.int,
  }),
  tools: [auditPatterns],
});
export default dockerfileSecurityAuditor;
