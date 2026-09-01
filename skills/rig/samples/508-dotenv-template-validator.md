# 508 - Dotenv Template Validator

```rig
import { agent, p, s, defineTool, steering } from "rig";

const compareEnvKeys = defineTool("compareEnvKeys", {
  description: "Compare env keys between a template and actual .env file",
  parameters: s.object({ template: s.string, actual: s.string }),
  handler: ({ template, actual }: { template: string; actual: string }) => {
    const parseKeys = (content: string) =>
      content.split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter((l: string) => l && !l.startsWith("#"))
        .map((l: string) => l.split("=")[0].trim())
        .filter(Boolean);
    const templateKeys = new Set(parseKeys(template));
    const actualKeys = new Set(parseKeys(actual));
    const missingInEnv = [...templateKeys].filter((k: string) => !actualKeys.has(k));
    const extraInEnv = [...actualKeys].filter((k: string) => !templateKeys.has(k));
    const completenessScore = templateKeys.size > 0
      ? Math.round(((templateKeys.size - missingInEnv.length) / templateKeys.size) * 100)
      : 100;
    return { missingInEnv, extraInEnv, totalTemplate: templateKeys.size, totalActual: actualKeys.size, completenessScore };
  },
});

// Agent role: Compare .env.example template keys against actual .env and report completeness.
const dotenvTemplateValidator = agent({
  model: "small",
  instructions: p`Compare env template ${p.read(".env.example")} with actual env ${p.readOptional(".env", "")}.
Call compareEnvKeys with both file contents.
Determine the status: complete (no missing, no extra), missing-keys, extra-keys, or mismatch (both).
Return the declared output.`,
  output: s.object({
    missingInEnv: s.array(s.string),
    extraInEnv: s.array(s.string),
    totalTemplate: s.int,
    totalActual: s.int,
    completenessScore: s.number,
    status: s.enum("complete", "missing-keys", "extra-keys", "mismatch"),
  }),
  tools: [compareEnvKeys],
  addons: [steering()],
});

export default dotenvTemplateValidator;
```
