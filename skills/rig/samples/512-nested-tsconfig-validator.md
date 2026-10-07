# 512 - Nested Tsconfig Validator

```rig
import { agent, p, s } from "rig";

// Agent role: read tsconfig.json, validate it against a deeply nested schema, and report validation issues.
const validateTsconfig = agent({
  model: "small",
  instructions: p`Inspect the project's tsconfig at ${p.read("tsconfig.json")}.
Parse it and validate it against the required nested structure: a top-level object
that may contain "compilerOptions" with optional "strict" (boolean), optional
"target" (string), and optional "paths" (a record mapping string keys to arrays
of string values). Flag any structural problems (e.g. wrong types, malformed
paths entries, missing compilerOptions) as human-readable issue strings. Set
"valid" to true only if no issues were found.`,
  output: s.object({
    valid: s.boolean,
    issues: s.array(s.string),
  }),
});

export default validateTsconfig;
```
