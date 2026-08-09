# 382 - Pkg Scripts Documenter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const inferScriptPurpose = defineTool("inferScriptPurpose", {
  description: "Classify an npm script by its command string into a category",
  parameters: s.object({
    name: s.string,
    command: s.string,
  }),
  handler: ({ command }: { name: string; command: string }) => {
    const lower = command.toLowerCase();
    if (/\btest\b|jest|vitest|mocha/.test(lower)) return "test" as const;
    if (/\bbuild\b|tsc|webpack|rollup|vite build/.test(lower)) return "build" as const;
    if (/\blint\b|eslint|prettier/.test(lower)) return "lint" as const;
    if (/\brelease\b|publish|changeset/.test(lower)) return "release" as const;
    if (/\bdev\b|start|watch|serve/.test(lower)) return "dev" as const;
    return "other" as const;
  },
});

// Agent role: Read package.json scripts, classify each by purpose, and write a SCRIPTS.md documentation file.
const pkgScriptsDocumenter = agent({
  model: "small",
  instructions: p`You are a package.json scripts documenter.
Read the package.json: ${p.read("package.json")}

For each script in the "scripts" field, call inferScriptPurpose to classify it.
Then write a SCRIPTS.md file using ${p.write("SCRIPTS.md", "## Scripts\n\n<!-- generated -->")} as the write intent path.
Return the complete output schema with all scripts, their purposes, categories, and commands.`,
  output: s.object({
    scripts: s.record(s.object({
      purpose: s.string,
      category: s.enum("build", "test", "lint", "release", "dev", "other"),
      command: s.string,
    })),
    documentedCount: s.int,
    outputFile: s.string,
  }),
  tools: [inferScriptPurpose],
  addons: [repair()],
});

export default pkgScriptsDocumenter;
```
