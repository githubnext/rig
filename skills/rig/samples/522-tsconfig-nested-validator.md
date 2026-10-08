# 522 - Tsconfig Nested Validator

```rig
import { agent, p, s } from "rig";

// Agent role: validate tsconfig.json structure and report issues.
const tsconfigValidator = agent({
  model: "small",
  instructions: p`Read ${p.read("tsconfig.json")}. Validate its compilerOptions against the expected shape: strict should be a boolean if present, target should be a string if present, and paths (if present) should be a record mapping string keys to arrays of string path patterns. Report whether the file is valid, list any issues found (missing/malformed fields, wrong types), and give a one-sentence summary.`,
  output: s.object({
    valid: s.boolean,
    issues: s.array(s.string),
    summary: s.string,
  }),
});

export default tsconfigValidator;
```
