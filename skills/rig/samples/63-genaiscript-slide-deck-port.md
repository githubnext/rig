# 63 - GenAIScript Slide Deck Port

```rig
import { agent, p, s } from "rig";
// Agent role: turn the README into a short slide deck outline.
const slideDeckPort = agent({
  model: "mini",
  instructions: p`Read ${p.read("README.md")} and draft a short markdown slide deck outline with terse titles and short bullets.`,
  output: s.object({ slides: s.array(s.object({ title: s.string, bullets: s.array(s.string) })) }),
});
export default slideDeckPort;
```
