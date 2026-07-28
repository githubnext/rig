# 241 - Npm Script Dep Mapper

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseScriptDeps = defineTool("parseScriptDeps", {
  description: "Parse npm scripts JSON and extract per-script dependency metadata.",
  parameters: { scriptsJson: s.string },
  handler: ({ scriptsJson }: { scriptsJson: string }) => {
    const scripts: Record<string, string> = JSON.parse(scriptsJson);
    const result: Record<string, {
      command: string;
      dependsOn: string[];
      category: string;
      hasPreHook: boolean;
      hasPostHook: boolean;
    }> = {};
    for (const [name, command] of Object.entries(scripts)) {
      const refs = [...command.matchAll(/npm run ([a-z0-9:_-]+)/gi)].map((m: RegExpMatchArray) => m[1]);
      const hasPreHook = (`pre${name}`) in scripts;
      const hasPostHook = (`post${name}`) in scripts;
      let category = "util";
      if (/build|compile|bundle/.test(name)) category = "build";
      else if (/test|spec|coverage/.test(name)) category = "test";
      else if (/lint|format|check/.test(name)) category = "lint";
      else if (/dev|start|watch/.test(name)) category = "dev";
      else if (/deploy|publish|release/.test(name)) category = "deploy";
      else if (/^pre|^post/.test(name)) category = "hook";
      result[name] = { command, dependsOn: refs, category, hasPreHook, hasPostHook };
    }
    return result;
  },
});

// Agent role: map npm script dependencies in the workspace package.json.
const npmScriptDepMapper = agent({
  model: "small",
  instructions: p`Analyze the npm scripts in the workspace package.json.
package.json content: ${p.read("package.json")}

Steps:
1. Extract the "scripts" field from the package.json content as a JSON string.
2. Call parseScriptDeps with that JSON string.
3. Return the result directly as the output record.`,
  output: s.record(s.object({
    command: s.string,
    dependsOn: s.array(s.string),
    category: s.enum("build", "test", "lint", "dev", "deploy", "util", "hook", "other"),
    hasPreHook: s.boolean,
    hasPostHook: s.boolean,
  })),
  tools: [parseScriptDeps],
  maxTurns: 6,
  addons: [repair()],
});

export default npmScriptDepMapper;
```
