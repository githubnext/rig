import { agent, p, s, defineTool, repair } from "rig";

const detectConflicts = defineTool("detectConflicts", {
  description: "Detect rule conflicts between Prettier and ESLint configs",
  parameters: s.object({ prettierConfig: s.string, eslintConfig: s.string }),
  handler({ prettierConfig, eslintConfig }) {
    const conflicts: { rule: string; prettier: string; eslint: string; fixable: boolean }[] = [];
    try {
      const p = JSON.parse(prettierConfig || "{}");
      const e = JSON.parse(eslintConfig || "{}");
      const rules = (e.rules || {});
      if (p.printWidth && rules["max-len"]) {
        conflicts.push({ rule: "line-length", prettier: `printWidth: ${p.printWidth}`, eslint: `max-len: ${JSON.stringify(rules["max-len"])}`, fixable: true });
      }
      if (p.singleQuote !== undefined && rules["quotes"]) {
        conflicts.push({ rule: "quotes", prettier: `singleQuote: ${p.singleQuote}`, eslint: `quotes: ${JSON.stringify(rules["quotes"])}`, fixable: true });
      }
    } catch {
      // invalid JSON — model will handle
    }
    return { conflicts };
  },
});

// Agent role: check Prettier and ESLint configs for rule conflicts and report compatibility issues.
const prettierEslintCompat = agent({
  model: "typecheck",
  instructions: p`Read the Prettier config ${p.readOptional(".prettierrc")} and ESLint config ${p.readOptional(".eslintrc.json")} then use the detectConflicts tool to find rule conflicts. Classify each conflict by severity.`,
  output: s.object({
    conflicts: s.array(s.object({
      rule: s.string,
      prettier: s.string,
      eslint: s.string,
      fixable: s.boolean,
      severity: s.enum("error", "warning", "info"),
    })),
    compatible: s.boolean,
  }),
  tools: [detectConflicts],
  maxTurns: 6,
  addons: repair(),
});

export default prettierEslintCompat;

