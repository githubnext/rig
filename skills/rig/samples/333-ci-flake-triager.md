# 333 - CI Flake Triager

```rig
import { agent, p, s, repair } from "rig";

// Agent role: triage the most recent CI test failure and classify it by root cause.
const ciFlakeTriager = agent({
  model: "small",
  instructions: p`Recent test log:
${p.bash("cat test-results/last-failure.log 2>/dev/null || echo 'No test log found'")}

Workflow file:
${p.readOptional(".github/workflows/ci.yml", "(no ci.yml found)")}

Classify the failure. Return failureClass, confidence (0-1), retryAdvice, and affected test names.`,
  output: s.object({
    failureClass: s.enum("infrastructure", "assertion", "timeout", "unknown"),
    confidence: s.number,
    retryAdvice: s.string,
    affectedTests: s.array(s.string),
  }),
  addons: [repair()],
  maxTurns: 2,
});

export default ciFlakeTriager;
```
