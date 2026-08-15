# 420 - NPM Script Prefix Analyzer

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyScriptPrefix = defineTool("classifyScriptPrefix", {
  description: "Extract and classify the command prefix of an npm script",
  parameters: s.object({ scriptName: s.string, command: s.string }),
  handler: ({ scriptName: _scriptName, command }: { scriptName: string; command: string }) => {
    const firstToken = command.trim().split(/\s+/)[0] ?? "";
    let prefixClass: "node" | "ts-node" | "npx" | "shell" | "other";
    if (firstToken === "node") prefixClass = "node";
    else if (firstToken === "ts-node" || firstToken === "tsx") prefixClass = "ts-node";
    else if (firstToken === "npx") prefixClass = "npx";
    else if (["bash", "sh", "zsh", "echo", "rm", "cp", "mkdir"].includes(firstToken)) prefixClass = "shell";
    else prefixClass = "other";
    return { command, prefix: firstToken, prefixClass };
  },
});

// Agent role: Analyze the command prefixes of all npm scripts and produce a summary of script types.
const npmScriptPrefixAnalyzer = agent({
  model: "small",
  instructions: p`Analyze the command prefixes of all npm scripts.
package.json: ${p.read("package.json")}
For each script in the "scripts" field, use classifyScriptPrefix with the script name and its command string.
Return:
- scripts: record mapping script name to { command, prefix, prefixClass }
- totalScripts: total number of scripts
- prefixCounts: record mapping each prefixClass value to how many scripts use it`,
  output: s.object({
    scripts: s.record(s.object({
      command: s.string,
      prefix: s.string,
      prefixClass: s.enum("node", "ts-node", "npx", "shell", "other"),
    })),
    totalScripts: s.int,
    prefixCounts: s.record(s.int),
  }),
  tools: [classifyScriptPrefix],
  addons: [steering()],
});

export default npmScriptPrefixAnalyzer;
```
