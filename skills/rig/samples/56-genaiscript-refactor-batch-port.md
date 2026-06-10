# 56 - GenAIScript Refactor Batch Port

```rig
import { agent, p, s } from "rig";
// Agent role: suggest metadata refactors for the first three sample files.
const refactorOne = agent({ model: "mini", instructions: "Suggest one minimal metadata cleanup for a rig sample.", output: s.object({ file: s.string, change: s.string }) });
const refactorBatch = agent({
  model: "mini",
  instructions: p`Inspect ${p.bash("find skills/rig/samples -maxdepth 1 -name '*.md' | sort | head -n 3")}. Use refactorOne when helpful and return only the smallest safe cleanup suggestions.`,
  output: s.object({ suggestions: s.array(s.object({ file: s.string, change: s.string })) }),
  agents: { refactorOne },
});
export default refactorBatch;
```
