# 519 - Nullable Env Config Resolver

```rig
import { agent, p, s } from "rig";

// Agent role: parse a .env-like config and classify each entry's resolution source.
const resolveEnvConfig = agent({
  model: "small",
  instructions: p`Given the raw config contents below, parse each line into key=value pairs.
Ignore blank lines and lines starting with '#'. For each entry, classify source as:
"file" if the key has a non-empty value present in the file, "default" if the key is present
but has no value (empty string after '='), and "missing" if the raw content is literally "none"
(no file found) in which case return an empty array.

Raw config contents:
${p.bash("cat .env.example 2>/dev/null || echo none")}

Return only the declared output.`,
  output: s.array(s.object({
    key: s.string,
    value: s.optional(s.string),
    source: s.enum("file", "default", "missing"),
  })),
});

export default resolveEnvConfig;
```
