# 365 - NPM Lifecycle Script Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyScript = defineTool("classifyScript", {
  description: "Classify an npm script by its lifecycle category.",
  parameters: { name: s.string, command: s.string },
  handler: ({ name, command }: { name: string; command: string }) => {
    const hookPrefixes = ["pre", "post"];
    const isHook = hookPrefixes.some((prefix) =>
      ["build", "test", "install", "pack", "publish", "start", "stop", "restart"].some(
        (base) => name === `${prefix}${base}`
      )
    );
    let category: "build" | "test" | "lint" | "release" | "hook" | "other" = "other";
    if (isHook) category = "hook";
    else if (/\b(build|compile|tsc|webpack|rollup|vite|esbuild)\b/.test(command)) category = "build";
    else if (/\b(test|jest|vitest|mocha|jasmine|tap)\b/.test(command)) category = "test";
    else if (/\b(lint|eslint|tslint|prettier|stylelint|biome)\b/.test(command)) category = "lint";
    else if (/\b(release|publish|deploy|version|changelog)\b/.test(command)) category = "release";
    return { category, isHook };
  },
});

const npmLifecycleScriptAnalyzer = agent({
  model: "small",
  instructions: p`Analyze npm lifecycle scripts from package.json.

package.json:
${p.read("package.json")}

Steps:
1. Parse the scripts field from package.json.
2. For each script entry (name, command), call classifyScript to get category and isHook.
3. Build scripts record keyed by script name with command, category, isHook.
4. hookCount = number of scripts with isHook true.
5. missingRecommended = array of recommended script names not present: ["test", "build", "lint"].
6. hasTestScript = "test" key exists in scripts.
7. hasBuildScript = "build" key exists in scripts.`,
  output: s.object({
    scripts: s.record(
      s.object({
        command: s.string,
        category: s.enum("build", "test", "lint", "release", "hook", "other"),
        isHook: s.boolean,
      })
    ),
    hookCount: s.number,
    missingRecommended: s.array(s.string),
    hasTestScript: s.boolean,
    hasBuildScript: s.boolean,
  }),
  tools: [classifyScript],
  addons: [repair()],
});

export default npmLifecycleScriptAnalyzer;
```
