# 525 - Lint Test Gate Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: run a lint-like check and report pass/fail with issues.
const lintCheck = agent({
  model: "small",
  instructions: p`Run ${p.bash("npx tsc --noEmit 2>&1 | head -50 || true")} and report whether it passed (no errors), listing any issues found as short strings.`,
  output: s.object({
    passed: s.boolean,
    issues: s.array(s.string),
  }),
});

// Agent role: run a test-like check and report pass/fail with failures.
const testCheck = agent({
  model: "small",
  instructions: p`Run ${p.bash("npx vitest run --reporter=dot 2>&1 | tail -50 || true")} and report whether the tests passed, listing any failures found as short strings.`,
  output: s.object({
    passed: s.boolean,
    failures: s.array(s.string),
  }),
});

// Agent role: combine lint and test results into a final approve/block decision.
const gate = agent({
  model: "small",
  input: s.object({
    lint: s.object({ passed: s.boolean, issues: s.array(s.string) }),
    test: s.object({ passed: s.boolean, failures: s.array(s.string) }),
  }),
  instructions:
    "Given input.lint and input.test results, decide \"approved\" only if both passed; otherwise \"blocked\". Give a one-sentence reason referencing the specific failures.",
  output: s.object({
    decision: s.enum("approved", "blocked"),
    reason: s.string,
  }),
});

// Workflow role: run lint and test checks, then gate on their combined result.
const lintTestGate = workflow({
  meta: {
    name: "lint-test-gate",
    description: "Run lint and test checks, then gate on the combined result",
    phases: ["Lint", "Test", "Gate"],
  },
  body: async ({ call, phase }) => {
    phase("Lint");
    const lint = await call(lintCheck, "run lint check", { label: "lint" });
    phase("Test");
    const test = await call(testCheck, "run test check", { label: "test" });
    phase("Gate");
    return call(
      gate,
      {
        lint: lint ?? { passed: false, issues: ["lint check failed to run"] },
        test: test ?? { passed: false, failures: ["test check failed to run"] },
      },
      { label: "gate" },
    );
  },
});

export default lintTestGate;
```
