# 516 - Fanout File Tag Aggregator

```rig
import { agent, p, s } from "rig";

// Agent role: read one source file and assign topical tags to it.
const tagger = agent({
  name: "tagger",
  model: "small",
  input: s.object({ path: s.path }),
  output: s.object({
    tags: s.array(s.enum("schema", "prompt", "engine", "test", "util")),
  }),
  instructions: p`Read ${p.readInput("path")} and assign one or more topical tags that best describe its content.`,
});

// Agent role: discover TypeScript source files, delegate tagging per file to the
// tagger subagent, and aggregate results into a tag-to-file-paths map.
const tagAggregator = agent({
  name: "tagAggregator",
  model: "small",
  agents: { tagger },
  output: s.object({
    tagsToFiles: s.record(s.array(s.path)),
  }),
  instructions: p`Find source files with ${p.glob("src/**/*.ts")}. For each discovered path, call tagger with { path } to obtain its tags. Aggregate the results into a single map from each tag to the list of file paths assigned that tag, and return it as tagsToFiles.`,
});

export default tagAggregator;
```
