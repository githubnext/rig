# 531 - Commit Type Classifier

```rig
import { agent, p, s } from "rig";

// Agent role: classify recent commit subjects into conventional-commit types.
const classifyCommits = agent({
  model: "small",
  instructions: p`Classify each commit subject from ${p.bash("git log --oneline -n 30 --pretty=format:'%s'")}
    into a conventional-commit type and group subjects by type.`,
  output: s.record(
    s.array(s.string),
    "commit subjects grouped by conventional-commit type",
  ),
});

export default classifyCommits;
```
