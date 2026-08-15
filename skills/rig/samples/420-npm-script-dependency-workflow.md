# 420 - Npm Script Dependency Workflow

```rig
import { agent, p, s, workflow } from "rig";

const scriptSchema = s.record(s.object({
  command: s.string,
  deps: s.array(s.string),
}));

// Agent role: build a dependency graph of npm scripts by parsing cross-references.
const scriptGraphBuilder = agent({
  model: "small",
  output: s.object({ scripts: scriptSchema }),
  instructions: p`Read package.json and build a dependency graph of npm scripts.

${p.read("package.json")}

For each script, identify which other scripts it references (e.g. via "npm run X" or "yarn X"). Return a scripts record where each entry has the command string and a deps array of referenced script names.`,
});

// Agent role: detect cycles in the npm script dependency graph using DFS.
const cycleDetector = agent({
  model: "small",
  input: s.object({ scripts: scriptSchema }),
  output: s.object({
    hasCycles: s.boolean,
    cycles: s.array(s.array(s.string)),
    totalNodes: s.number,
  }),
  instructions: p`Detect cycles in the npm script dependency graph provided in input.scripts using DFS. Return hasCycles, cycles (each cycle as an array of script names), and totalNodes.`,
});

// Workflow role: build npm script dependency graph, detect cycles, and produce a recommendation.
const npmScriptDependencyWorkflow = workflow({
  meta: { name: "npmScriptDependency", description: "NPM script dependency cycle detector", phases: ["Build", "Detect", "Recommend"] },
  body: async ({ call, phase }) => {
    phase("Build");
    const graph = await call(scriptGraphBuilder, "build graph");
    if (!graph) return { scriptCount: 0, hasCycles: false, cycles: [], recommendation: "empty" as const };
    phase("Detect");
    const cycleResult = await call(cycleDetector, { scripts: graph.scripts });
    if (!cycleResult) return { scriptCount: Object.keys(graph.scripts).length, hasCycles: false, cycles: [], recommendation: "safe" as const };
    phase("Recommend");
    const scriptCount = Object.keys(graph.scripts).length;
    const recommendation = scriptCount === 0
      ? ("empty" as const)
      : cycleResult.hasCycles
        ? ("has-cycles" as const)
        : ("safe" as const);
    return {
      scriptCount,
      hasCycles: cycleResult.hasCycles,
      cycles: cycleResult.cycles,
      recommendation,
    };
  },
});

export default npmScriptDependencyWorkflow;
```
