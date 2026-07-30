import { agent, p, s, defineTool, repair } from "rig";

const classifyStyle = defineTool("classifyStyle", {
  description: "Classify a file's module style based on require vs import counts",
  parameters: s.object({ file: s.string, requireCount: s.int, importCount: s.int }),
  handler({ requireCount, importCount }) {
    if (requireCount === 0 && importCount === 0) return "unknown" as const;
    if (requireCount > 0 && importCount > 0) return "mixed" as const;
    if (requireCount > 0) return "cjs" as const;
    return "esm" as const;
  },
});

// Agent role: Classify each JavaScript file by its module system (ESM vs CJS) based on import/require usage.
const importStyleChecker = agent({
  model: "typecheck",
  instructions: p`Analyze JavaScript files to classify their module system style.

Files with require/import patterns:
${p.bash("find . -name '*.js' -not -path '*/node_modules/*' | head -10 | xargs grep -hn '^require\\|^import ' 2>/dev/null | head -80 || echo 'no imports'")}

For each file found, count occurrences of require(...) and import statements.
Use the classifyStyle tool to determine the module style per file.
Return counts per file and summary totals.`,
  output: s.object({
    files: s.record(s.object({
      style: s.enum("esm", "cjs", "mixed", "unknown"),
      requireCount: s.int,
      importCount: s.int,
    })),
    esmCount: s.int,
    cjsCount: s.int,
    mixedCount: s.int,
    unknownCount: s.int,
  }),
  tools: [classifyStyle],
  addons: [repair()],
});

export default importStyleChecker;
