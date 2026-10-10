# 535 - Lint Test Gate Workflow

```rig
import { agent, p, s, workflow } from "rig";

const checkResult = s.object({
  passed: s.boolean,
  issues: s.array(s.string),
});

// Agent role: run a typecheck-style lint pass and report issues.
const lintCheck = agent({
  model: "small",
  instructions: p`Run ${p.bash("npx tsc --noEmit")} and report whether it passed
    and list any issues found.`,
  output: checkResult,
});

// Agent role: run the test suite and report issues.
const testCheck = agent({
  model: "small",
  instructions: p`Run ${p.bash("npx vitest run")} and report whether it passed
    and list any issues found.`,
  output: checkResult,
});

// Agent role: combine lint and test results into an approval decision.
const gate = agent({
  model: "small",
  input: s.object({ lint: checkResult, test: checkResult }),
  instructions:
    "Given input.lint and input.test, decide whether to approve or block, and explain why.",
  output: s.object({
    decision: s.enum("approved", "blocked"),
    reasons: s.array(s.string),
  }),
});

// Workflow role: sequentially gate changes on lint and test results.
const releaseGate = workflow({
  meta: {
    name: "release-gate",
    description: "Chain lint-check and test-check results into a gate decision",
    phases: ["Lint", "Test", "Gate"],
  },
  body: async ({ call, phase }) => {
    phase("Lint");
    const lint = await call(lintCheck, "");
    phase("Test");
    const test = await call(testCheck, "");
    phase("Gate");
    return call(gate, {
      lint: lint ?? { passed: false, issues: ["lint check failed to run"] },
      test: test ?? { passed: false, issues: ["test check failed to run"] },
    });
  },
});

export default releaseGate;
```
