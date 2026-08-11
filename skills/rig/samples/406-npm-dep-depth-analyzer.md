# 406 - Npm Dep Depth Analyzer

```rig
import { agent, p, s, repair, defineTool } from "rig";

const classifyDepDepth = defineTool("classifyDepDepth", {
  description: "Parse npm ls JSON output and classify each dependency by depth.",
  parameters: s.object({ npmLsJson: s.string }),
  handler: ({ npmLsJson }: { npmLsJson: string }) => {
    type DepEntry = { version?: string; dependencies?: Record<string, DepEntry> };
    const packages: Record<string, { depth: number; depthClass: "direct" | "transitive-shallow" | "transitive-deep" }> = {};
    let maxDepth = 0;
    let directCount = 0;
    function walk(node: DepEntry, depth: number): void {
      if (!node.dependencies) return;
      for (const [name, child] of Object.entries(node.dependencies)) {
        if (depth > maxDepth) maxDepth = depth;
        const depthClass: "direct" | "transitive-shallow" | "transitive-deep" =
          depth === 1 ? "direct" : depth === 2 ? "transitive-shallow" : "transitive-deep";
        if (!packages[name]) {
          packages[name] = { depth, depthClass };
          if (depth === 1) directCount++;
        }
        walk(child, depth + 1);
      }
    }
    try {
      const tree = JSON.parse(npmLsJson) as DepEntry;
      walk(tree, 1);
    } catch {
      // empty tree
    }
    return { packages, maxDepth, directCount };
  },
});

// Agent role: Analyze npm dependency depth by reading package.json and running npm ls.
const npmDepDepthAnalyzer = agent({
  model: "small",
  instructions: p`package.json:
${p.read("package.json")}

npm dependency tree (JSON):
${p.bash("npm ls --depth=3 --json 2>/dev/null || echo '{}'")}

Use the classifyDepDepth tool with the npm ls JSON output above. Return packages, maxDepth, and directCount.`,
  tools: [classifyDepDepth],
  output: s.object({
    packages: s.record(
      s.object({
        depth: s.int,
        depthClass: s.enum("direct", "transitive-shallow", "transitive-deep"),
      })
    ),
    maxDepth: s.int,
    directCount: s.int,
  }),
  addons: [repair()],
});

export default npmDepDepthAnalyzer;
```
