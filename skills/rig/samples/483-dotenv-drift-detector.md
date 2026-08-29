# 483 - Dotenv Drift Detector

```rig
import { agent, defineTool, p, repair, s } from "rig";

const classifyEnvKey = defineTool("classifyEnvKey", {
  description: "Classify an env key as declared, undeclared, or unused given env example keys and code keys.",
  parameters: s.object({
    key: s.string,
    exampleKeys: s.array(s.string),
    codeKeys: s.array(s.string),
  }),
  handler: async ({ key, exampleKeys, codeKeys }) => {
    const inExample = exampleKeys.includes(key);
    const usedInCode = codeKeys.includes(key);
    let status: "declared" | "undeclared" | "unused";
    if (inExample && usedInCode) status = "declared";
    else if (!inExample && usedInCode) status = "undeclared";
    else status = "unused";
    return { inExample, usedInCode, status };
  },
});

// Agent role: detect drift between .env.example declarations and process.env usage in source code.
const dotenvDriftDetector = agent({
  model: "small",
  instructions: p`Read the .env.example file: ${p.readOptional(".env.example", "# empty")}. Find all process.env usages in source code: ${p.bash("grep -rn 'process\\.env\\.' src/ 2>/dev/null || echo 'no matches'")}. Extract the declared keys from .env.example (lines matching KEY=) and the used keys from grep output (process.env.KEY patterns). For each unique key across both sets, call classifyEnvKey. Return keys as a record with inExample, usedInCode, status. Include totalKeys, missingFromExample (keys used in code but not in .env.example), and unusedDeclarations (keys in .env.example not used in code).`,
  output: s.object({
    keys: s.record(s.object({
      inExample: s.boolean,
      usedInCode: s.boolean,
      status: s.enum("declared", "undeclared", "unused"),
    })),
    totalKeys: s.int,
    missingFromExample: s.array(s.string),
    unusedDeclarations: s.array(s.string),
  }),
  tools: [classifyEnvKey],
  maxTurns: 6,
  addons: [repair()],
});

export default dotenvDriftDetector;
```
