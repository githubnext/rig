# 323 - CI Flake Triager

```rig
import { agent, p, s, repair } from "rig";

// Agent role: triage a CI test failure and classify it by root cause.
const ciFlakeTriager = agent({
  model: "small",
  maxTurns: 2,
  instructions: p`Triage the most recent CI test failure in this repository.
Last test run output: ${p.bash("npm test 2>&1 | tail -80 || echo 'no test output'")}
CI workflow file: ${p.readOptional(".github/workflows/ci.yml", "# no CI workflow found")}
Classify the failure type, assess confidence, give retry advice, and list affected tests.`,
  output: s.object({
    failureClass: s.enum("infrastructure", "assertion", "timeout", "unknown"),
    confidence: s.enum("high", "medium", "low"),
    retryAdvice: s.string,
    affectedTests: s.array(s.string),
  }),
  addons: [repair()],
});

export default ciFlakeTriager;
```
