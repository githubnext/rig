# 486 - TS Abstract Class Finder

```rig
import { agent, defineTool, p, s, steering } from "rig";

const extractAbstractClasses = defineTool("extractAbstractClasses", {
  description: "Extract abstract class declarations and their abstract methods from a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf-8");
    const classPattern = /abstract\s+class\s+(\w+)[^{]*\{/g;
    const abstractMethodPattern = /abstract\s+(?:readonly\s+)?(?:\w+\s*[(<])/g;
    const classes: Array<{ name: string; methodCount: number; abstractMethodCount: number; sourceFile: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = classPattern.exec(content)) !== null) {
      const name = m[1];
      const methodMatches = content.match(/\b(?:public|protected|private|async)?\s+\w+\s*[(<]/g) ?? [];
      const abstractMatches = content.match(abstractMethodPattern) ?? [];
      classes.push({
        name,
        methodCount: methodMatches.length,
        abstractMethodCount: abstractMatches.length,
        sourceFile: filePath,
      });
    }
    return classes;
  },
});

// Agent role: find abstract classes and their abstract method counts across TypeScript source files.
const tsAbstractClassFinder = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.glob("src/**/*.ts")}. For each file path, call extractAbstractClasses. Build a classes record keyed by class name with methodCount, abstractMethodCount, sourceFile. Include totalClasses, totalAbstractMethods, and mostAbstractFile (path with most abstract methods, omit if none found).`,
  output: s.object({
    classes: s.record(s.object({
      methodCount: s.int,
      abstractMethodCount: s.int,
      sourceFile: s.path,
    })),
    totalClasses: s.int,
    totalAbstractMethods: s.int,
    mostAbstractFile: s.optional(s.string),
  }),
  tools: [extractAbstractClasses],
  maxTurns: 8,
  addons: [steering()],
});

export default tsAbstractClassFinder;
```
