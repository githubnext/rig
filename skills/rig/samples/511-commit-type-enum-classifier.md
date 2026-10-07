# 511 - Commit Type Enum Classifier

```rig
import { agent, p, s } from "rig";

// Agent role: classify recent commit messages into conventional-commit types
// and group the matching subject lines by type.
const classifyCommits = agent({
  name: "commit-type-enum-classifier",
  model: "small",
  instructions: p`Classify each commit subject from the log below into exactly one type:
feat, fix, docs, chore, refactor, test, or other. Use the conventional-commit
prefix if present (e.g. "feat:", "fix(scope):"); otherwise infer the best
matching type from the subject wording, defaulting to "other" when unclear.

${p.bash("git log -20 --oneline")}

Return a record keyed by commit type, where each value is the array of full
commit subject strings (without the hash) classified under that type. Omit
keys with no matches.`,
  output: s.record(s.array(s.string)),
});

export default classifyCommits;
```
