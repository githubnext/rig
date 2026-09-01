# 502 - NPM Script Prefix Analyzer

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const classifyScriptPrefix = defineTool("classifyScriptPrefix", {
  description: "Classify the command prefix of an npm script",
  parameters: s.object({ command: s.string }),
  handler: ({ command }: { command: string }) => {
    const first = command.trim().split(/\s+/)[0] ?? "";
    if (first === "node") return "node" as const;
    if (first === "ts-node" || first === "ts-node-esm") return "ts-node" as const;
    if (first === "npx") return "npx" as const;
    if (first === "sh" || first === "bash" || first === "zsh" || first.startsWith("./")) return "shell" as const;
    return "other" as const;
  },
});

// Agent role: Analyze npm script command prefixes in package.json and summarize by prefix class.
const npmScriptPrefixAnalyzer = agent({
  model: "small",
  instructions: p`Analyze the npm scripts in: ${p.read("package.json")}.
For each script, call classifyScriptPrefix with the script command.
Return the declared output with per-script details and a summary of prefix counts.`,
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
  addons: [steering(), repair()],
});

export default npmScriptPrefixAnalyzer;
```
