# 52 - Claude Design (Critique-Revise)

```rig
import { agent, s } from "rig";
// Agent role: coordinate writer/critic/reviser to produce one final response.
const writer = agent({
  model: "mini",
  output: s.object({ draft: s.string }),
  instructions: "Write a helpful, clear response to the request.",
});
const critic = agent({
  model: "mini",
  input: s.object({ request: s.string, draft: s.string }),
  output: s.object({ issues: s.array(s.string), score: s.number, acceptable: s.boolean }),
  instructions: "Evaluate the draft against helpfulness, harmlessness, and honesty principles.",
});
const reviser = agent({
  model: "mini",
  input: s.object({ request: s.string, draft: s.string, issues: s.array(s.string) }),
  output: s.object({ response: s.string }),
  instructions: "Revise the draft to address all issues identified by the critic.",
});
const root = agent({ model: "mini",
  instructions: "Use writer, critic, and reviser to produce one final response.",
  output: s.object({ response: s.string }),
  agents: { writer, critic, reviser },
});
export default root;
```
