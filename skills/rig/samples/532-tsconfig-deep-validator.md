# 532 - Tsconfig Deep Validator

```rig
import { agent, p, s } from "rig";

// Agent role: validate tsconfig.json compiler options and report issues.
const validateTsconfig = agent({
  model: "small",
  instructions: p`Validate ${p.read("tsconfig.json")} and report whether strict mode
    is enabled, the configured target, whether path mappings are configured, the
    path mappings themselves if present, and any validation issues found.`,
  output: s.object({
    hasStrict: s.boolean,
    target: s.optional(s.string),
    pathsConfigured: s.boolean,
    pathMappings: s.optional(s.record(s.array(s.string))),
    issues: s.array(s.string),
  }),
});

export default validateTsconfig;
```
