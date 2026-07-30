import { agent, p, s, defineTool, repair } from "rig";

const extractInterfaceExtends = defineTool("extractInterfaceExtends", {
  description: "Extract TypeScript interface declarations and their extends relationships from file content",
  parameters: s.object({ content: s.string }),
  handler: ({ content }) => {
    const results: Array<{ name: string; extends: string[] }> = [];
    const re = /interface\s+(\w+)(?:<[^>]+>)?\s*(?:extends\s+([\w<>, ]+))?\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      const extendsClause = m[2] ?? "";
      const parents = extendsClause
        ? extendsClause.split(",").map((p: string) => p.trim().replace(/<.*>/, "").trim()).filter(Boolean)
        : [];
      results.push({ name, extends: parents });
    }
    return JSON.stringify(results);
  },
});

// Agent role: build a TypeScript interface inheritance graph from source files
const tsInterfaceInheritanceGraph = agent({
  name: "tsInterfaceInheritanceGraph",
  model: "typecheck",
  addons: repair(),
  tools: [extractInterfaceExtends],
  instructions: p`Build a TypeScript interface inheritance graph.

TypeScript source files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -name '*.d.ts' | head -30")}

Interface declarations from source: ${p.bash("grep -rh 'interface ' . --include='*.ts' 2>/dev/null | grep -v node_modules | head -100")}

For each source file group, call extractInterfaceExtends with the combined content.
Build a graph where each interface node lists its parent interfaces.
Classify each interface's depth: root (no parents), derived (has parents), or leaf (no children).
Compute totalInterfaces and maxDepth (longest inheritance chain).`,
  output: s.object({
    interfaces: s.record(
      s.object({
        parents: s.array(s.string),
        depth: s.enum("root", "derived", "leaf"),
      })
    ),
    totalInterfaces: s.int,
    maxDepth: s.int,
  }),
});

export default tsInterfaceInheritanceGraph;
