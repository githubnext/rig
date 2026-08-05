# 371 - NPM Lifecycle Script Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyScript = defineTool("classifyScript", {
  description: "Classify an npm script by name and command into a lifecycle category.",
  parameters: s.object({ scriptName: s.string, command: s.string }),
  handler({ scriptName }) {
    const name = scriptName.toLowerCase();
    const isHook = /^(pre|post)/.test(name);
    if (/build|compile|bundle|webpack|rollup|esbuild|tsc/.test(name)) return { category: "build" as const, isHook };
    if (/test|jest|vitest|mocha|spec|coverage/.test(name)) return { category: "test" as const, isHook };
    if (/lint|eslint|tslint|prettier|format|check/.test(name)) return { category: "lint" as const, isHook };
    if (/release|publish|deploy|version|changelog/.test(name)) return { category: "release" as const, isHook };
    if (isHook) return { category: "hook" as const, isHook: true };
    return { category: "other" as const, isHook: false };
  },
});

// Agent role: analyze npm lifecycle scripts in package.json and classify each one.
const npmLifecycleScriptAnalyzer = agent({
  model: "small",
  instructions: p`Analyze the npm lifecycle scripts defined in package.json.

package.json contents:
${p.read("package.json")}

For each entry in the "scripts" field, call classifyScript with the script name and command.
Build a scripts record keyed by script name with command, category, and isHook fields.
Count hookCount (total scripts where isHook is true).
List missingRecommended: which of ["test", "build", "lint"] category names are absent from the scripts.
Set hasTestScript to true if any script has category "test", hasBuildScript if any has category "build".`,
  tools: [classifyScript],
  output: s.object({
    scripts: s.record(
      s.object({
        command: s.string,
        category: s.enum("build", "test", "lint", "release", "hook", "other"),
        isHook: s.boolean,
      })
    ),
    hookCount: s.int,
    missingRecommended: s.array(s.string),
    hasTestScript: s.boolean,
    hasBuildScript: s.boolean,
  }),
  maxTurns: 4,
  addons: repair(),
});

export default npmLifecycleScriptAnalyzer;

```
