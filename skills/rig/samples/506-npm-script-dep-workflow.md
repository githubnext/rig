# 506 - NPM Script Dep Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Read package.json and build a graph of npm script dependencies via pre/post hooks.
const scriptGraphBuilder = agent({
  name: "scriptGraphBuilder",
  model: "small",
  instructions: p`Read package.json: ${p.read("package.json")}.
Extract all npm scripts. For each script, identify its pre/post hook dependencies (e.g., "prebuild" runs before "build").
Return the declared output.`,
  output: s.object({
    scripts: s.record(s.object({
      command: s.string,
      deps: s.array(s.string),
    })),
    totalScripts: s.int,
  }),
});

// Agent role: Detect cycles in a script dependency graph using DFS.
const cycleDetector = agent({
  name: "cycleDetector",
  model: "small",
  input: s.object({
    scripts: s.record(s.object({
      command: s.string,
      deps: s.array(s.string),
    })),
    totalScripts: s.int,
  }),
  instructions: `Analyze the provided script dependency graph for cycles using DFS.
Return whether cycles exist, list any cycles found, and the total node count.`,
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(s.array(s.string)),
    totalNodes: s.int,
  }),
});

// Workflow role: Build npm script dependency graph then detect cycles.
const npmScriptDepWorkflow = workflow({
  meta: { name: "npm-script-dep-workflow", description: "Analyze npm script pre/post dependency graph and detect cycles" },
  body: async ({ call }) => {
    const graph = await call(scriptGraphBuilder, "build script graph from package.json");
    const scripts = graph?.scripts ?? {};
    const totalScripts = graph?.totalScripts ?? 0;
    const cycles = await call(cycleDetector, { scripts, totalScripts });
    const hasCycles = cycles?.hasCycles ?? false;
    const cycleList = cycles?.cycles ?? [];
    let recommendation: "safe" | "has-cycles" | "empty" = "safe";
    if (totalScripts === 0) recommendation = "empty";
    else if (hasCycles) recommendation = "has-cycles";
    return { scriptCount: totalScripts, hasCycles, cycles: cycleList, recommendation };
  },
});

export default npmScriptDepWorkflow;
```
