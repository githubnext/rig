# 526 - Glob Tagger Aggregator

```rig
import { agent, p, s } from "rig";

// Agent role: assign a topical tag to one source file.
const tagger = agent({
  model: "nano",
  input: s.object({ path: s.path }),
  instructions: p`Read ${p.readInput("path")} and assign exactly one topical tag describing its role.`,
  output: s.object({
    path: s.path,
    tag: s.enum("core", "test", "utility", "type", "config"),
  }),
});

// Agent role: find all TypeScript source files, tag each one, and aggregate paths by tag.
const tagAggregator = agent({
  model: "small",
  agents: { tagger },
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. For each path, delegate to tagger to assign a topical tag, then return a record mapping each tag to the array of file paths that received that tag.`,
  output: s.record(s.array(s.path), "file paths keyed by topical tag"),
});

export default tagAggregator;
```
