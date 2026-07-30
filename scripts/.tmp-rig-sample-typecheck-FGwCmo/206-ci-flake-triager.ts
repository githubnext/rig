import { agent, p, s, repair } from "rig";

// Agent role: triage the most recent CI test failure and classify its root cause.
const ciFlakeTriager = agent({
  model: "typecheck",
  instructions: p`Inspect available CI logs: ${p.bash("cat .github/test-results.log 2>/dev/null || cat test-results.log 2>/dev/null || echo 'no test log found'")}. Also read the CI workflow configuration: ${p.readOptional(".github/workflows/ci.yml", "no ci workflow found")}. Classify the failure type: infrastructure (runner issue, network, timeout on setup), assertion (test logic failed), timeout (test exceeded time limit), or unknown. Estimate confidence. List the names of affected tests if identifiable. Provide a concrete one-sentence retry advice.`,
  output: s.object({
    failureClass: s.enum("infrastructure", "assertion", "timeout", "unknown"),
    confidence: s.enum("high", "medium", "low"),
    retryAdvice: s.string,
    affectedTests: s.array(s.string),
  }),
  maxTurns: 4,
  addons: repair(),
});

export default ciFlakeTriager;
