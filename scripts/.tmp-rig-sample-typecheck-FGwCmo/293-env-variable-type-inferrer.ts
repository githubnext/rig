import { agent, p, s, defineTool, repair } from "rig";

const inferType = defineTool("inferType", {
  description: "Infer the type of an environment variable value",
  parameters: s.object({ key: s.string, value: s.string }),
  handler: ({ value }) => {
    if (value === "true" || value === "false") return "boolean" as const;
    if (/^\d+(\.\d+)?$/.test(value)) return "number" as const;
    if (/^https?:\/\//.test(value)) return "url" as const;
    if (/^[./~]|^\$HOME/.test(value)) return "path" as const;
    if (value.length === 0 || value.startsWith("<") || value.startsWith("#")) return "unknown" as const;
    return "string" as const;
  },
});

// Agent role: infer types of environment variables from .env.example
const envVariableTypeInferrer = agent({
  model: "typecheck",
  instructions: p`Analyze the environment variable definitions from ${p.readOptional(".env.example", "# no .env.example found")} and use the inferType tool for each variable. Produce a record of variable names to their inferred type and description, plus allDocumented indicating whether all variables have non-empty descriptions.`,
  output: s.object({
    variables: s.record(s.object({
      type: s.enum("string", "number", "boolean", "url", "path", "unknown"),
      description: s.string,
    })),
    allDocumented: s.boolean,
  }),
  tools: [inferType],
  addons: [repair()],
});

export default envVariableTypeInferrer;
