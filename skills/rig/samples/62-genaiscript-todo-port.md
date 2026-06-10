# 62 - GenAIScript TODO Port

```rig
import { agent, p, s } from "rig";
// Agent role: propose minimal TODO implementations from the current workspace.
const todoPort = agent({
  model: "mini",
  instructions: p`Check ${p.bash("rg -n 'TODO' src skills scripts . || true")}. For up to one actionable TODO, return the target file and the minimal implementation plan.`,
  output: s.object({ todos: s.array(s.object({ file: s.string, plan: s.string })) }),
});
export default todoPort;
```
