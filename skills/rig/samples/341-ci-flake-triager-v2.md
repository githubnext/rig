# 341 - CI Flake Triager V2

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Collect the last failed test log and CI workflow config, classify the failure type, and return structured triage output.
const ciFlakeTriager = agent({
  model: "small",
  instructions: p`You are a CI flake triager. Analyze the following test output and workflow config to classify the failure.

Test output:
${p.bash("npm test 2>&1 | tail -100")}

Workflow config:
${p.readOptional(".github/workflows/ci.yml")}

${defineTool("classifyFailure", {
  description: "Classify a CI failure based on error message text",
  parameters: s.object({ errorText: s.string }),
  handler: (args) => {
    const t = args.errorText.toLowerCase();
    const failureClass =
      t.includes("timeout") || t.includes("timed out") ? "timeout" as const
      : t.includes("econnrefused") || t.includes("network") || t.includes("spawn") ? "infrastructure" as const
      : t.includes("expected") || t.includes("assert") || t.includes("toequal") ? "assertion" as const
      : "unknown" as const;
    return { failureClass };
  },
})}

Classify the failure and return the required output.`,
  output: s.object({
    failureClass: s.enum("infrastructure", "assertion", "timeout", "unknown"),
    confidence: s.number,
    retryAdvice: s.string,
    affectedTests: s.array(s.string),
  }),
  maxTurns: 2,
  addons: [repair()],
});

export default ciFlakeTriager;
```
