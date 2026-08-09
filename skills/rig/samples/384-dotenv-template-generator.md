# 384 - Dotenv Template Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractEnvReferences = defineTool("extractEnvReferences", {
  description: "Extract all process.env.VAR_NAME references from a TypeScript file",
  parameters: s.object({
    filePath: s.path,
  }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const matches = [...content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)];
    return [...new Set(matches.map((m) => m[1]))];
  },
});

// Agent role: Discover all environment variable references in TypeScript source files, compare with .env, and write a .env.template.
const dotenvTemplateGenerator = agent({
  model: "small",
  instructions: p`You are a dotenv template generator.
Existing .env file (if any): ${p.readOptional(".env")}
TypeScript source files to scan: ${p.glob("src/**/*.ts")}

For each TypeScript file found, call extractEnvReferences to get all process.env references.
Collect all unique env keys referenced across all files.
Compare with keys found in .env (lines starting with KEY=).
Write the template to: ${p.write(".env.template", "# Generated .env template")}
Return the output schema.`,
  output: s.object({
    templatePath: s.string,
    envKeys: s.array(s.string),
    undocumentedKeys: s.array(s.string),
    templateGenerated: s.boolean,
  }),
  tools: [extractEnvReferences],
  addons: [repair()],
});

export default dotenvTemplateGenerator;
```
