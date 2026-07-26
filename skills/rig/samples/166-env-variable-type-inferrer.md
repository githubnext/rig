# 166 - Env Variable Type Inferrer

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: infer the type and purpose of each variable defined in a .env.example file.
const envVariableTypeInferrer = agent({
  model: "small",
  instructions: p`Infer the type and purpose of each environment variable in the project.

.env.example contents:
${p.readOptional(".env.example")}

.env.sample contents:
${p.readOptional(".env.sample")}

For each KEY=value pair found, use the inferType tool to classify the value type. Produce a description of each variable's likely purpose based on its name. Determine whether all variables appear to be documented (have a non-empty value or comment). Return only the declared output.`,
  tools: [
    defineTool("inferType", {
      description: "Infer the type of an environment variable value",
      parameters: s.object({ key: s.string, value: s.string }),
      handler({ value }) {
        const v = value.trim();
        if (/^https?:\/\//i.test(v)) return { type: "url" as const };
        if (/^\/|^\.\.?\//.test(v)) return { type: "path" as const };
        if (/^(true|false)$/i.test(v)) return { type: "boolean" as const };
        if (/^\d+(\.\d+)?$/.test(v)) return { type: "number" as const };
        if (v === "") return { type: "unknown" as const };
        return { type: "string" as const };
      },
    }),
  ],
  output: s.object({
    variables: s.record(s.object({
      type: s.enum("string", "number", "boolean", "url", "path", "unknown"),
      description: s.string,
    })),
    totalCount: s.int,
    allDocumented: s.boolean,
  }),
});

export default envVariableTypeInferrer;
```
