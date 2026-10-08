# 521 - Commit Type Tagger

```rig
import { agent, p, s } from "rig";

// Agent role: classify recent commit messages by conventional-commit type.
const commitTagger = agent({
  model: "small",
  instructions: p`Review the recent commit subjects: ${p.bash("git log -20 --pretty=%s")}. Classify each commit subject into a conventional-commit type (feat, fix, docs, chore, refactor, test, or other), then return a record mapping each type to the array of matching commit subjects. Include a key only when at least one commit matches that type.`,
  output: s.record(s.array(s.string), "commit subjects keyed by conventional-commit type"),
});

export default commitTagger;
```
