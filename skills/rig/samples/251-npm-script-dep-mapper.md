# 251 - Npm Script Dep Mapper

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseScriptDeps = defineTool("parseScriptDeps", {
  description: "Extract npm run references and detect pre/post hooks for a script",
  parameters: s.object({
    scriptName: s.string,
    scriptBody: s.string,
    allScriptNames: s.array(s.string),
  }),
  handler: ({ scriptName, scriptBody, allScriptNames }) => {
    const deps: string[] = [];
    const runRefs = scriptBody.match(/npm run ([\w:.-]+)/g) ?? [];
    runRefs.forEach((ref: string) => deps.push(ref.replace("npm run ", "")));
    const hasPreHook = allScriptNames.includes("pre" + scriptName);
    const hasPostHook = allScriptNames.includes("post" + scriptName);
    return JSON.stringify({ deps, hasPreHook, hasPostHook });
  },
});

// Agent role: map npm script dependencies and classify each script by category
const npmScriptDepMapper = agent({
  name: "npmScriptDepMapper",
  model: "small",
  maxTurns: 2,
  addons: repair(),
  tools: [parseScriptDeps],
  instructions: p`Analyze npm scripts from package.json and map their dependencies.

package.json: ${p.read("package.json")}

For each script, call parseScriptDeps with the scriptName, scriptBody, and list of all script names.
Classify each script's category: build, test, lint, dev, deploy, util, hook, or other.
A script is a hook category if its name starts with pre or post.
Set hasPreHook and hasPostHook based on tool output.
Return a record keyed by script name.`,
  output: s.record(
    s.object({
      command: s.string,
      dependsOn: s.array(s.string),
      category: s.enum("build", "test", "lint", "dev", "deploy", "util", "hook", "other"),
      hasPreHook: s.boolean,
      hasPostHook: s.boolean,
    })
  ),
});

export default npmScriptDepMapper;
```
