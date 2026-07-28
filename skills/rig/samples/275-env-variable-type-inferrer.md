# 275 - Env Variable Type Inferrer

```rig
import { agent, p, s, defineTool } from "rig";

const inferType = defineTool("inferType", {
  description: "Infer the type of an environment variable value using regex patterns.",
  parameters: s.object({ key: s.string, value: s.string }),
  handler({ value }) {
    if (/^\d+(\.\d+)?$/.test(value)) return "number" as const;
    if (/^(true|false)$/i.test(value)) return "boolean" as const;
    if (/^https?:\/\//.test(value)) return "url" as const;
    if (/^[/~.]/.test(value)) return "path" as const;
    if (value.length === 0) return "unknown" as const;
    return "string" as const;
  },
});

// Agent role: read .env.example and infer the type of each variable.
const envVariableTypeInferrer = agent({
  model: "small",
  instructions: p`Infer types for environment variables from .env.example.

File contents:
${p.readOptional(".env.example", "# no .env.example found")}

For each non-comment, non-empty line, parse KEY=VALUE.
Call inferType with the key and value to determine the type.
Write a one-line description for each variable based on its key name and inferred type.
Build the variables record keyed by variable name.
Set allDocumented to true if all variables have non-empty descriptions.`,
  tools: [inferType],
  output: s.object({
    variables: s.record(
      s.object({
        type: s.enum("string", "number", "boolean", "url", "path", "unknown"),
        description: s.string,
      })
    ),
    allDocumented: s.boolean,
  }),
});

export default envVariableTypeInferrer;
```
