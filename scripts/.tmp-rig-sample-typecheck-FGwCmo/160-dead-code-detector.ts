import { agent, defineTool, p, repair, s } from "rig";

// Agent role: detect dead TypeScript exports by scanning for exported symbols and estimating usage counts.
const deadCodeDetector = agent({
  model: "typecheck",
  instructions: p`Detect dead code in this TypeScript project. 

Files in project:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -40")}

Exported symbols found:
${p.bash("grep -rn '^export ' --include='*.ts' . 2>/dev/null | grep -v node_modules | head -60")}

Use the estimateUsage tool for each exported symbol name to count how many times it appears across the codebase. Classify each as: "used" (>1 reference), "possibly-dead" (exactly 1, the declaration itself), or "dead" (0 references outside declaration). Return only the declared output.`,
  tools: [
    defineTool("estimateUsage", {
      description: "Count non-declaration usages of an exported symbol across the codebase",
      parameters: s.object({ symbol: s.string }),
      async handler({ symbol }) {
        const { execSync } = await import("node:child_process");
        try {
          const out = execSync(
            `grep -rn "\\b${symbol}\\b" --include="*.ts" . 2>/dev/null | grep -v "^export " | grep -v node_modules | wc -l`,
            { encoding: "utf-8" }
          );
          return { symbol, usageCount: parseInt(out.trim(), 10) };
        } catch {
          return { symbol, usageCount: 0 };
        }
      },
    }),
  ],
  addons: [repair()],
  output: s.object({
    symbols: s.record(s.object({
      usageCount: s.int,
      status: s.enum("used", "possibly-dead", "dead"),
    })),
    totalExported: s.int,
    deadCount: s.int,
  }),
});

export default deadCodeDetector;
