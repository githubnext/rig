# 536 - Glob Tagger Fanout

```rig
import { agent, p, s } from "rig";

// Agent role: assign a topical tag to a single source file.
const tagger = agent({
  model: "small",
  input: s.object({ path: s.path }),
  instructions: p`Read ${p.readInput("path")} and assign the single most fitting tag.`,
  output: s.object({
    path: s.path,
    tag: s.enum("test", "schema", "engine", "prompt", "utility", "other"),
  }),
});

// Agent role: discover source files, delegate tagging, and aggregate by tag.
const coordinator = agent({
  model: "small",
  agents: { tagger },
  instructions: p`Find source files with ${p.glob("src/**/*.ts")}. For each
    discovered path, delegate to tagger, then return a record mapping each
    tag to the list of file paths assigned that tag.`,
  output: s.record(s.array(s.path), "file paths grouped by assigned tag"),
});

export default coordinator;
```
