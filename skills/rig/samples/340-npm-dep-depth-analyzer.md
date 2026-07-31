# 340 - NPM Dep Depth Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyDepDepth = defineTool("classifyDepDepth", {
  description: "Parse npm ls JSON and classify dependency depth",
  parameters: s.object({ lsJson: s.string }),
  handler: ({ lsJson }: { lsJson: string }) => {
    let tree: Record<string, unknown>;
    try { tree = JSON.parse(lsJson); } catch { return { packages: {}, maxDepth: 0, directCount: 0 }; }
    const packages: Record<string, { depth: number; depthClass: "direct" | "shallow" | "deep" | "very-deep" }> = {};
    let maxDepth = 0;
    let directCount = 0;
    const walk = (node: unknown, depth: number) => {
      if (!node || typeof node !== "object") return;
      const deps = (node as Record<string, unknown>)["dependencies"];
      if (!deps || typeof deps !== "object") return;
      for (const [name, child] of Object.entries(deps as Record<string, unknown>)) {
        if (depth === 1) directCount++;
        const depthClass: "direct" | "shallow" | "deep" | "very-deep" =
          depth === 1 ? "direct" as const
          : depth === 2 ? "shallow" as const
          : depth === 3 ? "deep" as const
          : "very-deep" as const;
        packages[name] = { depth, depthClass };
        if (depth > maxDepth) maxDepth = depth;
        walk(child, depth + 1);
      }
    };
    walk(tree, 1);
    return { packages, maxDepth, directCount };
  },
});

// Agent role: analyze npm dependency depth from package.json and npm ls output.
const npmDepDepthAnalyzer = agent({
  model: "small",
  instructions: p`package.json: ${p.read("package.json")}
npm ls output: ${p.bash("npm ls --depth=3 --json 2>/dev/null || echo '{}'")
}
Call classifyDepDepth with the npm ls JSON. Return packages record, maxDepth, and directCount.`,
  output: s.object({
    packages: s.record(s.object({
      depth: s.int,
      depthClass: s.enum("direct", "shallow", "deep", "very-deep"),
    })),
    maxDepth: s.int,
    directCount: s.int,
  }),
  tools: [classifyDepDepth],
  addons: [repair()],
  maxTurns: 4,
});

export default npmDepDepthAnalyzer;
```
