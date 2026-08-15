# 411 - TS Generic Constraint Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: extract generic type constraints from TypeScript files and summarize per file.
const tsGenericConstraintExtractor = agent({
  model: "small",
  instructions: p`Extract TypeScript generic type constraints (patterns like \`T extends ...\`) from source files.

TypeScript files: ${p.bash("find src -name '*.ts' 2>/dev/null | head -50 || echo ''")}

For each file path, call extractGenericConstraints. Then produce the declared output.`,
  tools: [
    defineTool("extractGenericConstraints", {
      description: "Extract generic type constraints from a TypeScript file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        try {
          const content = await readFile(filePath, "utf-8");
          const regex = /\bextends\s+([^\s,>{=]+(?:\s*[<(][^>)]*[>)])?)/g;
          const constraints: string[] = [];
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            constraints.push(m[1].trim());
          }
          return { filePath, constraints };
        } catch {
          return { filePath, constraints: [] };
        }
      },
    }),
  ],
  output: s.object({
    constraints: s.record(s.array(s.string)),
    totalConstraints: s.int,
    constrainedCount: s.int,
    mostConstrainedFile: s.optional(s.string),
  }),
  addons: [repair()],
});

export default tsGenericConstraintExtractor;

```
