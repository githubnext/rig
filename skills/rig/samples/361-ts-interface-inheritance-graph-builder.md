# 361 - TS Interface Inheritance Graph Builder

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractInterfaceExtends = defineTool("extractInterfaceExtends", {
  description: "Parse a TypeScript file and return all interface declarations with their extends clauses.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const results: Array<{ name: string; parents: string[] }> = [];
      const re = /interface\s+(\w+)(?:\s+extends\s+([\w,\s]+))?/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const parents = m[2]
          ? m[2].split(",").map((p) => p.trim()).filter(Boolean)
          : [];
        results.push({ name: m[1], parents });
      }
      return results;
    } catch {
      return [];
    }
  },
});

const tsInterfaceInheritanceGraphBuilder = agent({
  model: "small",
  instructions: p`Build a TypeScript interface inheritance graph.

TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -20")}

Steps:
1. For each file, call extractInterfaceExtends to get interface declarations and their parents.
2. Aggregate all interfaces into a record keyed by interface name. Each entry: parents (array of parent interface names), depth classification.
3. Classify depth: "root" = no parents, "derived" = has parents and at least one child, "leaf" = has parents but no children.
4. totalInterfaces = total count across all files.
5. maxDepth = maximum inheritance chain depth (BFS from each root).`,
  output: s.object({
    interfaces: s.record(
      s.object({
        parents: s.array(s.string),
        depth: s.enum("root", "derived", "leaf"),
      })
    ),
    totalInterfaces: s.number,
    maxDepth: s.number,
  }),
  tools: [extractInterfaceExtends],
  addons: [repair()],
});

export default tsInterfaceInheritanceGraphBuilder;
```
