# 47 - Prompt Intents

```rig
import { agent, p, s } from "rig";

// Agent role: summarize the current git workspace changes.

const promptIntents = agent({
  model: "mini",
  instructions: "Summarize the current git workspace changes.",
  output: s.object({
    summary: s.string,
    changedFiles: s.array(s.string),
  }),
});

export default promptIntents;
```
