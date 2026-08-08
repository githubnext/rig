# 376 - Dotenv Template Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractEnvReferences = defineTool("extractEnvReferences", {
  description: "Extract process.env.X references from a TypeScript file.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const pattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
      const keys = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) keys.add(m[1]);
      return { keys: Array.from(keys) };
    } catch {
      return { keys: [] };
    }
  },
});

// Agent role: generate a .env.template from process.env references in source files.
const dotenvTemplateGenerator = agent({
  model: "small",
  instructions: p`Generate a .env.template file from process.env references in TypeScript source files.

Existing .env file (if present):
${p.readOptional(".env", "(no .env file found)")}

TypeScript source files:
${p.glob("src/**/*.ts")}

Steps:
1. For each TypeScript file path listed above, call extractEnvReferences to get the list of env keys.
2. Collect all unique keys referenced across all files → envKeys.
3. Parse the existing .env content to find documented keys.
4. undocumentedKeys = envKeys not already in .env.
5. Write .env.template with each key as KEY= (one per line, with a comment header).
6. templatePath = ".env.template", templateGenerated = true.`,
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
