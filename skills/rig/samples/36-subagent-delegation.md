# 36 - Subagent Delegation

With an AWF gateway that supports these aliases, the researcher requests a
small model and the planner requests a larger one. Actual selection depends on
the provider; a workflow-provided Copilot SDK model can override both.

```rig
import { agent, s } from "rig";
// Agent role: extract the most important implementation details from the topic.
const researcher = agent({
  model: "small",
  output: s.object({ summary: s.string, risks: s.array(s.string) }),
  instructions: "Extract the most important implementation details from the topic.",
});
// Agent role: plan the next steps and use the researcher when helpful.
const planner = agent({
  model: "large",
  instructions: "Plan the next steps for explaining runtime-visible schemas in one paragraph. Use the researcher when helpful.",
  output: s.object({ decision: s.string, nextSteps: s.array(s.string) }),
  agents: { researcher },
});
export default planner;
```
