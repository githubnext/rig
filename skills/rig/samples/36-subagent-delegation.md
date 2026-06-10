# 36 - Subagent Delegation

```rig
import { agent, s } from "rig";
// Agent role: extract the most important implementation details from the topic.
const researcher = agent({
  model: "mini",
  output: s.object({ summary: s.string, risks: s.array(s.string) }),
  instructions: "Extract the most important implementation details from the topic.",
});
// Agent role: plan the next steps and use the researcher when helpful.
const planner = agent({
  model: "mini",
  instructions: "Plan the next steps for explaining runtime-visible schemas in one paragraph. Use the researcher when helpful.",
  output: s.object({ decision: s.string, nextSteps: s.array(s.string) }),
  agents: { researcher },
});
export default planner;
```
