# 283 - Env Variable Type Inferrer

```rig
import { agent, defineTool, p, s } from "rig";

const inferVarType = defineTool("inferVarType", {
  description: "Infer the type of an environment variable value using regex heuristics.",
  parameters: s.object({ value: s.string }),
  handler({ value }: { value: string }) {
    if (/^https?:\/\//i.test(value)) return "url" as const;
    if (/^(true|false|yes|no|1|0)$/i.test(value)) return "boolean" as const;
    if (/^\d+(\.\d+)?$/.test(value)) return "number" as const;
    if (/^(\/|\.\/|~\/)/.test(value) || /\.(txt|json|yaml|yml|pem|key|crt)$/.test(value)) return "path" as const;
    if (value === "") return "unknown" as const;
    return "string" as const;
  },
});

// Agent role: infer types for all environment variables defined in .env.example.
const envVariableTypeInferrer = agent({
  model: "small",
  instructions: p`Infer the type of each environment variable defined in the .env.example file.

.env.example contents:
${p.readOptional(".env.example", "(no .env.example found)")}

For each KEY=VALUE line, call inferVarType with the value to get its type. Generate a short description of what each variable likely controls. Set allDocumented to true only if every variable has a non-empty value or inline comment hint.`,
  tools: [inferVarType],
  output: s.object({
    vars: s.record(
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
