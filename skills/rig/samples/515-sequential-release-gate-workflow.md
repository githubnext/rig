# 515 - Sequential Release Gate Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: run typecheck and report pass/fail with captured output.
const lintCheck = agent({
  name: "lintCheck",
  model: "small",
  instructions: p`Run ${p.bash("npm run typecheck")} and report whether it passed.`,
  output: s.object({
    pass: s.boolean,
    output: s.string,
  }),
});

// Agent role: run the test suite and report pass/fail with captured output.
const testCheck = agent({
  name: "testCheck",
  model: "small",
  instructions: p`Run ${p.bash("npm test")} and report whether it passed.`,
  output: s.object({
    pass: s.boolean,
    output: s.string,
  }),
});

// Agent role: combine lint and test results into a final release gate decision.
const releaseGate = agent({
  name: "releaseGate",
  model: "small",
  input: s.object({
    lintPass: s.boolean,
    lintOutput: s.string,
    testPass: s.boolean,
    testOutput: s.string,
  }),
  instructions: p`Given lint pass=${p.inputField("lintPass")} with output ${p.inputField("lintOutput")}, and test pass=${p.inputField("testPass")} with output ${p.inputField("testOutput")}, decide whether the release is approved or blocked and list reasons.`,
  output: s.object({
    decision: s.enum("approved", "blocked"),
    reasons: s.array(s.string),
  }),
});

// Workflow role: sequentially gate a release through lint, test, then a final decision step.
const releaseGateWorkflow = workflow({
  meta: {
    name: "sequential-release-gate",
    description: "Chain lint check, test check, and gate decision sequentially",
    phases: ["Lint", "Test", "Gate"],
  },
  body: async ({ call, phase }) => {
    phase("Lint");
    const lint = await call(lintCheck, "", { label: "lint" });
    const lintPass = lint?.pass ?? false;
    const lintOutput = lint?.output ?? "lint agent failed to run";

    phase("Test");
    const test = await call(testCheck, "", { label: "test" });
    const testPass = test?.pass ?? false;
    const testOutput = test?.output ?? "test agent failed to run";

    phase("Gate");
    const gate = await call(
      releaseGate,
      { lintPass, lintOutput, testPass, testOutput },
      { label: "gate" },
    );

    return { lint, test, gate };
  },
});

export default releaseGateWorkflow;
```
