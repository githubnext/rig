# 374 - Package Scripts Documenter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const inferScriptPurpose = defineTool("inferScriptPurpose", {
  description: "Classify a package.json script by its command into a category.",
  parameters: { name: s.string, command: s.string },
  handler: ({ name, command }: { name: string; command: string }) => {
    const cmd = command.toLowerCase();
    const nm = name.toLowerCase();
    let category: "build" | "test" | "lint" | "release" | "dev" | "other" = "other";
    if (/\btest\b|jest|vitest|mocha/.test(cmd) || /\btest/.test(nm)) category = "test";
    else if (/\bbuild\b|tsc|webpack|vite|rollup|esbuild/.test(cmd) || /\bbuild/.test(nm)) category = "build";
    else if (/\blint\b|eslint|prettier|biome/.test(cmd) || /\blint/.test(nm)) category = "lint";
    else if (/\brelease\b|publish|changeset|version/.test(cmd) || /\brelease\b|\bpublish/.test(nm)) category = "release";
    else if (/\bdev\b|watch|start\b|nodemon/.test(cmd) || /\bdev\b|\bstart\b|\bwatch/.test(nm)) category = "dev";
    const purpose = `Runs ${name}: ${command.slice(0, 60)}`;
    return { purpose, category } as const;
  },
});

// Agent role: document all package.json scripts with purpose and category, then write SCRIPTS.md.
const packageScriptsDocumenter = agent({
  model: "small",
  instructions: p`Document all scripts in package.json and write SCRIPTS.md.

package.json contents:
${p.read("package.json")}

Steps:
1. Parse the scripts object from the package.json content above.
2. For each script name and command, call inferScriptPurpose to get purpose and category.
3. Build the scripts record keyed by script name.
4. Write SCRIPTS.md using p.write with a markdown table listing each script, its category, and purpose.
5. documentedCount = number of scripts processed.
6. outputFile = "SCRIPTS.md".`,
  output: s.object({
    scripts: s.record(
      s.object({
        purpose: s.string,
        category: s.enum("build", "test", "lint", "release", "dev", "other"),
        command: s.string,
      })
    ),
    documentedCount: s.int,
    outputFile: s.path,
  }),
  tools: [inferScriptPurpose],
  addons: [repair()],
});

export default packageScriptsDocumenter;
```
