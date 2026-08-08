# 375 - TypeScript Class Hierarchy Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractClassInfo = defineTool("extractClassInfo", {
  description: "Extract class declarations with extends/implements from a TypeScript file",
  parameters: s.object({ filePath: s.string("path to TypeScript file") }),
  async handler({ filePath }) {
    try {
      const src = await readFile(filePath, "utf8");
      const classPattern = /(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
      const results: Array<{ name: string; parent: string | null; interfaces: string[]; isAbstract: boolean }> = [];
      for (const m of src.matchAll(classPattern)) {
        results.push({
          name: m[1],
          parent: m[2] ?? null,
          interfaces: m[3] ? m[3].split(",").map((s: string) => s.trim()).filter(Boolean) : [],
          isAbstract: src.slice(Math.max(0, m.index! - 10), m.index!).includes("abstract"),
        });
      }
      return JSON.stringify(results);
    } catch {
      return "[]";
    }
  },
});

// Agent role: build a class hierarchy map from all TypeScript files in the project.
const classHierarchyExtractor = agent({
  model: "small",
  maxTurns: 6,
  instructions: p`Extract the class hierarchy from this TypeScript project.

TypeScript files found:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -50")}

For each file, use extractClassInfo to find class declarations. Collect all class info, build a hierarchy by computing inheritance depth (root classes = depth 0, subclasses = parent depth + 1).

Return the complete class hierarchy in the output schema.`,
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

export default classHierarchyExtractor;
```
