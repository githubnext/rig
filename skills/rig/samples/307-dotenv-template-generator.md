# 307 - Dotenv Template Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractEnvReferences = defineTool("extractEnvReferences", {
  description: "Extract all process.env.VAR_NAME references from a TypeScript source file",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8").catch(() => "");
    const pattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
    const keys = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      if (m[1]) keys.add(m[1]);
    }
    return Array.from(keys);
  },
});

// Agent role: Generate a .env.template file by scanning source files for process.env references and comparing against existing .env keys.
const dotenvTemplateGenerator = agent({
  model: "small",
  instructions: p`Generate a .env.template file documenting all required environment variables.

Existing .env file:
${p.readOptional(".env", "# no .env file found")}

TypeScript source files to scan:
${p.glob("src/**/*.ts")}

Use the extractEnvReferences tool on each source file to find process.env.VAR references.
Collect all unique env keys found across all files (envKeys).
Compare with keys present in .env — undocumentedKeys are those referenced in code but missing from .env.
Write a .env.template with each key as KEY=<placeholder>.
${p.write(".env.template", "# Generated .env.template\n# Replace <placeholder> with actual values\n")}
Return templatePath as ".env.template", envKeys array, undocumentedKeys array, and templateGenerated as true.`,
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
