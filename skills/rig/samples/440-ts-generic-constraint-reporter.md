# 440 - TS Generic Constraint Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractGenericConstraints = defineTool("extractGenericConstraints", {
  description: "Extract generic type parameters and their extends constraints from a TypeScript file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const generics: Array<{ name: string; constraint?: string }> = [];
    const typeParamRe = /<([^>]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = typeParamRe.exec(content)) !== null) {
      const parts = match[1].split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        const extendsMatch = trimmed.match(/^(\w+)\s+extends\s+(.+)$/);
        if (extendsMatch) {
          generics.push({ name: extendsMatch[1], constraint: extendsMatch[2].trim() });
        } else if (/^\w+$/.test(trimmed)) {
          generics.push({ name: trimmed });
        }
      }
    }
    return { generics };
  },
});

// Agent role: report generic type constraints across TypeScript source files.
const tsGenericConstraintReporter = agent({
  model: "small",
  instructions: p`Report generic type constraints found in TypeScript source files.

TypeScript files:
${p.glob("src/**/*.ts")}

For each file, call extractGenericConstraints and collect the results.
Compute totalFiles (files processed), totalGenerics (sum of all generics found),
constrainedGenerics (generics that have a constraint), unconstrained (generics without a constraint).
Build files array with file path and its generics list.`,
  tools: [extractGenericConstraints],
  output: s.object({
    totalFiles: s.int,
    totalGenerics: s.int,
    constrainedGenerics: s.int,
    unconstrained: s.int,
    files: s.array(
      s.object({
        file: s.path,
        generics: s.array(s.object({ name: s.string, constraint: s.optional(s.string) })),
      })
    ),
  }),
  maxTurns: 6,
  addons: [repair()],
});

export default tsGenericConstraintReporter;
```
