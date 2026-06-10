# 07 - Summarize Many Files

```rig
import { agent, p, s } from "rig";

// Agent role: summarize the repository file list in one sentence.

const summarizeFiles = agent({
  model: "mini",
  instructions: "Summarize the repository file list in one sentence.",
  output: s.object({
    summary: s.string,
  }),
});

export default summarizeFiles;
```
