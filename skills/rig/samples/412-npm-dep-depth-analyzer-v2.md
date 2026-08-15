# 412 - NPM Dependency Depth Analyzer V2

```rig
import { agent, p, s, repair, defineTool } from "rig";

const classifyDepDepth = defineTool("classifyDepDepth", {
  description: "Parse npm ls --json output and classify each dependency by depth.",
  parameters: s.object({ npmLsJson: s.string }),
  handler: ({ npmLsJson }: { npmLsJson: string }) => {
    type DepNode = { dependencies?: Record<string, DepNode> };
    const packages: Record<string, { depth: number; depthClass: "shallow" | "medium" | "deep" }> = {};
    let maxDepth = 0;
    let directCount = 0;
    function walk(node: DepNode, depth: number): void {
      if (!node.dependencies) return;
      for (const [name, child] of Object.entries(node.dependencies)) {
        if (depth > maxDepth) maxDepth = depth;
        const depthClass: "shallow" | "medium" | "deep" =
          depth <= 1 ? "shallow" : depth <= 3 ? "medium" : "deep";
        if (!packages[name]) {
          packages[name] = { depth, depthClass };
          if (depth === 1) directCount++;
        }
        walk(child, depth + 1);
      }
    }
    try {
      walk(JSON.parse(npmLsJson) as DepNode, 1);
    } catch {
      // empty tree
    }
    return { packages, maxDepth, directCount };
  },
});

// Agent role: Analyze npm dependency depth by reading package.json and running npm ls.
const npmDepDepthAnalyzerV2 = agent({
  model: "small",
  instructions: p`package.json contents:
${p.read("package.json")}

npm dependency tree (JSON):
${p.bash("npm ls --depth=2 --json 2>/dev/null || echo '{}'")}

Call the classifyDepDepth tool with the npm ls JSON output. Return packages keyed by name, maxDepth, and directCount.`,
  tools: [classifyDepDepth],
  output: s.object({
    packages: s.record(
      s.object({
        depth: s.int,
        depthClass: s.enum("shallow", "medium", "deep"),
      })
    ),
    maxDepth: s.int,
    directCount: s.int,
  }),
  addons: [repair()],
});

export default npmDepDepthAnalyzerV2;

```
