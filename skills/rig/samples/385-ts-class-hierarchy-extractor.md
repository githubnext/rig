# 385 - TS Class Hierarchy Extractor

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractClassInfo = defineTool("extractClassInfo", {
  description: "Extract class declaration, extends, and implements info from a TypeScript file",
  parameters: s.object({
    filePath: s.path,
  }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const classRegex = /(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    const classes: Array<{ name: string; parent: string | null; interfaces: string[]; isAbstract: boolean }> = [];
    for (const m of content.matchAll(classRegex)) {
      classes.push({
        name: m[1],
        parent: m[2] ?? null,
        interfaces: m[3] ? m[3].split(",").map((s: string) => s.trim()) : [],
        isAbstract: content.slice(Math.max(0, m.index! - 10), m.index!).includes("abstract"),
      });
    }
    return classes;
  },
});

// Agent role: Extract class hierarchy information across all TypeScript files and report inheritance depth.
const tsClassHierarchyExtractor = agent({
  model: "small",
  instructions: p`You are a TypeScript class hierarchy extractor.
TypeScript files in project: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' | head -100")}

For each TypeScript file found, call extractClassInfo to get class declarations.
Aggregate all classes across files. Compute inheritance depth for each class by tracing parent chains.
Identify root classes (no parent). Return the output schema.`,
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
```
