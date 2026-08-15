# 415 - TypeScript Generic Constraint Extractor V2

```rig
import { agent, p, s, repair, defineTool } from "rig";

const extractGenericConstraints = defineTool("extractGenericConstraints", {
  description: "Extract generic type parameter constraints from a TypeScript file.",
  parameters: s.object({ filePath: s.string }),
  handler: async ({ filePath }: { filePath: string }) => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(filePath, "utf8");
    const matches = [...src.matchAll(/<([A-Z][a-zA-Z0-9]*)\s+extends\s+([^,>\n]+)/g)];
    const constraints = matches.map((m) => `${m[1]} extends ${m[2].trim()}`);
    return { constraints, count: constraints.length };
  },
});

// Agent role: Find TypeScript generic constraints (T extends ...) across all source files.
const tsGenericConstraintExtractorV2 = agent({
  model: "small",
  instructions: p`TypeScript files in this workspace:
${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -20")}

For each file path, call the extractGenericConstraints tool. Aggregate constraints into a record keyed by file path. Return totalConstraints as the total count, constrainedCount as the number of files with at least one constraint, and mostConstrainedFile as the file path with the highest count.`,
  tools: [extractGenericConstraints],
  maxTurns: 6,
  output: s.object({
    constraints: s.record(s.array(s.string)),
    totalConstraints: s.int,
    constrainedCount: s.int,
    mostConstrainedFile: s.optional(s.string),
  }),
  addons: [repair()],
});

export default tsGenericConstraintExtractorV2;

```
