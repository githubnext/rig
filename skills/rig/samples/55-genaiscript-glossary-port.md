# 55 - GenAIScript Glossary Port

```rig
import { agent, p, s } from "rig";
// Agent role: extract advanced rig glossary terms from docs.
const glossaryPort = agent({
  model: "mini",
  instructions: p`Read ${p.read("README.md")} and ${p.read("skills/rig/SKILL.md")}. Return only advanced rig terms with short definitions and skip duplicates.`,
  output: s.object({ terms: s.array(s.object({ term: s.string, definition: s.string })) }),
});
export default glossaryPort;
```
