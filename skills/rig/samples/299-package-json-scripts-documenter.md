# 299-package-json-scripts-documenter - Package Json Scripts Documenter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const inferScriptPurpose = defineTool("inferScriptPurpose", {
  description: "Classify an npm script and suggest a one-line description of its purpose",
  parameters: s.object({ name: s.string, command: s.string }),
  handler: ({ name, command }: { name: string; command: string }) => {
    const lname = name.toLowerCase();
    const lcmd = command.toLowerCase();
    let category: "build" | "test" | "lint" | "release" | "dev" | "other";
    if (lname.includes("build") || lcmd.includes("tsc") || lcmd.includes("webpack") || lcmd.includes("rollup") || lcmd.includes("vite build")) {
      category = "build";
    } else if (lname.includes("test") || lcmd.includes("vitest") || lcmd.includes("jest") || lcmd.includes("mocha")) {
      category = "test";
    } else if (lname.includes("lint") || lcmd.includes("eslint") || lcmd.includes("prettier")) {
      category = "lint";
    } else if (lname.includes("release") || lname.includes("publish") || lname.includes("version")) {
      category = "release";
    } else if (lname.includes("dev") || lname.includes("start") || lname.includes("watch")) {
      category = "dev";
    } else {
      category = "other";
    }
    return { category };
  },
});

// Agent role: document npm scripts from package.json and write a SCRIPTS.md file
const packageJsonScriptsDocumenter = agent({
  model: "small",
  instructions: p`Read the npm scripts from ${p.read("package.json")} and use the inferScriptPurpose tool for each script to classify it. Then write ${p.write("SCRIPTS.md", "scripts")} a well-structured markdown documentation file listing each script with its purpose, category, and command. Return the structured record of scripts, the count, and the output file path.`,
  output: s.object({
    scripts: s.record(s.object({
      purpose: s.string,
      category: s.enum("build", "test", "lint", "release", "dev", "other"),
      command: s.string,
    })),
    documentedCount: s.int,
    outputFile: s.path,
  }),
  tools: [inferScriptPurpose],
  addons: [repair()],
});

export default packageJsonScriptsDocumenter;
```
