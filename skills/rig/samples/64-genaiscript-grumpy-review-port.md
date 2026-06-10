# 64 - GenAIScript Grumpy Review Port

```rig
import { agent, p, s } from "rig";
// Agent role: review one rig sample in a terse critical voice.
const grumpyReviewPort = agent({
  model: "mini",
  instructions: p`Review ${p.read("skills/rig/samples/36-subagent-delegation.md")} in a terse senior-engineer voice. Be specific, but keep each point short.`,
  output: s.object({ findings: s.array(s.string), verdict: s.string }),
});
export default grumpyReviewPort;
```
