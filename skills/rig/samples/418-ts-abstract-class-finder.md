# 418 - TS Abstract Class Finder

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { readFile } from "node:fs/promises";

const extractAbstractClasses = defineTool("extractAbstractClasses", {
  description: "Extract abstract class declarations and count their abstract methods from a TypeScript file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const classRe = /abstract\s+class\s+(\w+)/g;
    const abstractMethodRe = /abstract\s+(?:\w+\s+)*(\w+)\s*\(/g;
    const classes: Array<{ name: string; methodCount: number; abstractMethodCount: number; sourceFile: string }> = [];
    let classMatch: RegExpExecArray | null;
    while ((classMatch = classRe.exec(content)) !== null) {
      const name = classMatch[1];
      // Count all method-like patterns in the file as approximation
      const allMethods = (content.match(/^\s+(?:(?:public|private|protected|async|static|readonly)\s+)*\w+\s*\(/gm) ?? []).length;
      const abstractMethods = (content.match(abstractMethodRe) ?? []).length;
      classes.push({ name, methodCount: allMethods, abstractMethodCount: abstractMethods, sourceFile: filePath });
    }
    return classes;
  },
});

// Agent role: Find all abstract classes in TypeScript source files and report their method counts.
const tsAbstractClassFinder = agent({
  model: "small",
  instructions: p`Find all abstract classes in TypeScript source files.
Files to scan: ${p.glob("src/**/*.ts")}
Use extractAbstractClasses on each file.
Aggregate results into a record keyed by class name.
Return:
- classes: record mapping class name to { methodCount, abstractMethodCount, sourceFile }
- totalClasses: total number of abstract classes found
- totalAbstractMethods: sum of all abstractMethodCount values
- mostAbstractFile: path of the file with the most abstract classes, or omit if none`,
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
  addons: [steering()],
});

export default tsAbstractClassFinder;
```
