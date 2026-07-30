import { agent, p, s, repair } from "rig";

// Agent role: run npm audit and produce a simplified grouped vulnerability report with remediation advice.
const npmAuditSimplifier = agent({
  model: "typecheck",
  instructions: p`Run ${p.bash("npm audit --json 2>/dev/null || echo '{}'")} to get the vulnerability report. Parse the JSON, group vulnerability package names by severity level, count totals, and provide a concise remediation recommendation.`,
  output: s.object({
    vulnerabilitiesByLevel: s.record(s.array(s.string)),
    totalCount: s.number,
    recommendation: s.string,
  }),
  maxTurns: 5,
  addons: repair(),
});

export default npmAuditSimplifier;
