# 496 - Npm Script Prefix Analyzer

```rig
import { agent, defineTool, p, s } from "rig";

const classifyScriptPrefix = defineTool("classifyScriptPrefix", {
  description: "Classify an npm script by its command prefix",
  parameters: s.object({ scriptName: s.string, command: s.string }),
  handler({ command }): "node" | "npm" | "npx" | "ts-node" | "sh" | "other" {
    const c = command.trim().split(" ")[0] ?? "";
    if (c === "node") return "node" as const;
    if (c === "npm") return "npm" as const;
    if (c === "npx") return "npx" as const;
    if (c === "ts-node" || c === "tsx") return "ts-node" as const;
    if (c === "sh" || c === "bash") return "sh" as const;
    return "other" as const;
  },
});

// Agent role: read package.json scripts and classify each by command prefix, returning counts per prefix.
const npmScriptPrefixAnalyzer = agent({
  model: "small",
  instructions: p`Read scripts from ${p.read("package.json")}. Use classifyScriptPrefix for each script entry to determine its command prefix. Return the per-script details and prefix counts.`,
  output: s.object({
    scripts: s.record(s.object({ command: s.string, prefix: s.string })),
    prefixCounts: s.record(s.int),
    totalScripts: s.int,
  }),
  tools: [classifyScriptPrefix],
});

export default npmScriptPrefixAnalyzer;
```
