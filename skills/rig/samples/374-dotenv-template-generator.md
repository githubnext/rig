# 374 - Dotenv Template Generator

```rig
import { agent, defineTool, p, s, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractEnvReferences = defineTool("extractEnvReferences", {
  description: "Extract all process.env.VARNAME references from a TypeScript file",
  parameters: s.object({ filePath: s.string("path to TypeScript file") }),
  async handler({ filePath }) {
    try {
      const src = await readFile(filePath, "utf8");
      const matches = [...src.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)];
      return [...new Set(matches.map((m) => m[1]))].join(",");
    } catch {
      return "";
    }
  },
});

// Agent role: generate a .env.template file from process.env references found in source files.
const dotenvTemplateGenerator = agent({
  model: "small",
  instructions: p`Generate a .env.template for this project.

Existing .env (if any):
${p.readOptional(".env", "# no .env found")}

TypeScript source files:
${p.glob("src/**/*.ts")}

For each TypeScript file path listed above, call extractEnvReferences to find process.env.VAR_NAME references.
Collect all unique variable names, compare with those already in .env, identify undocumented ones.
Then write a .env.template file using ${p.write(".env.template", "# Environment variables\n")}.

Return the output schema with templatePath, envKeys, undocumentedKeys, and templateGenerated.`,
  output: s.object({
    templatePath: s.path,
    envKeys: s.array(s.string),
    undocumentedKeys: s.array(s.string),
    templateGenerated: s.boolean,
  }),
  tools: [extractEnvReferences],
  addons: [repair()],
});

export default dotenvTemplateGenerator;
```
