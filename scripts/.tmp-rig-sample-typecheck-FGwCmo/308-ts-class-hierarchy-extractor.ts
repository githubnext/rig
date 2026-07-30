import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractClassInfo = defineTool("extractClassInfo", {
  description: "Extract class declarations, inheritance, and interface implementations from a TypeScript file",
  parameters: s.object({ filePath: s.string }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8").catch(() => "");
    const pattern = /(?:(abstract)\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    const classes: Array<{ className: string; parent?: string; interfaces: string[]; isAbstract: boolean }> = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      const interfaces = m[4] ? m[4].split(",").map((s: string) => s.trim()).filter(Boolean) : [];
      classes.push({
        className: m[2] ?? "",
        parent: m[3],
        interfaces,
        isAbstract: !!m[1],
      });
    }
    return classes;
  },
});

// Agent role: Build a class hierarchy map from TypeScript files showing inheritance and interface relationships.
const tsClassHierarchyExtractor = agent({
  model: "typecheck",
  instructions: p`Extract and map TypeScript class hierarchy from all source files.

TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -name '*.d.ts' | head -20 2>/dev/null || echo 'no ts files'")}

Use the extractClassInfo tool on each file to get class declarations with inheritance info.
For each class, compute depth: root classes (no parent) have depth 0; derived classes add 1 per level.
Set maxDepth to the deepest class depth found.
rootClasses are class names with no parent.
Return the structured output.`,
  output: s.object({
    classes: s.record(s.object({
      parent: s.optional(s.string),
      interfaces: s.array(s.string),
      isAbstract: s.boolean,
      depth: s.int,
    })),
    maxDepth: s.int,
    rootClasses: s.array(s.string),
  }),
  tools: [extractClassInfo],
  addons: [steering()],
});

export default tsClassHierarchyExtractor;
