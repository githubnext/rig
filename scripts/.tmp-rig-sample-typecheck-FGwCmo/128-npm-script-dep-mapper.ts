import { agent, p, s, defineTool, repair } from "rig";

const parseScriptDeps = defineTool("parseScriptDeps", {
  description: "Parse pre/post hooks and npm run references for a script",
  parameters: s.object({
    scriptName: s.string,
    scriptBody: s.string,
    allScripts: s.record(s.string),
  }),
  handler: ({ scriptName, scriptBody, allScripts }) => {
    const deps: string[] = [];
    const runRefs = scriptBody.match(/npm run ([\w:-]+)/g) || [];
    runRefs.forEach((r) => deps.push(r.replace("npm run ", "")));
    const preName = "pre" + scriptName;
    const postName = "post" + scriptName;
    if (allScripts[preName]) deps.push(preName);
    if (allScripts[postName]) deps.push(postName);
    return JSON.stringify(deps);
  },
});

// Agent role: map npm script dependencies by analyzing pre/post hooks and npm run references
const npmScriptDepMapper = agent({
  name: "npmScriptDepMapper",
  model: "typecheck",
  maxTurns: 2,
  addons: repair(),
  instructions: p`Map npm script dependencies by analyzing the package.json scripts.

package.json: ${p.read("package.json")}

For each script, use the parseScriptDeps tool to find its dependencies (npm run references and pre/post hooks).
Classify each script category:
- build: scripts that compile or bundle
- test: scripts that run tests
- lint: scripts that lint or format
- dev: scripts for development
- deploy: scripts for deployment
- util: utility scripts
- hook: pre/post lifecycle hooks
- other: anything else

Set hasPreHook and hasPostHook based on whether pre<name> or post<name> scripts exist.
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
  tools: [parseScriptDeps],
});

export default npmScriptDepMapper;
