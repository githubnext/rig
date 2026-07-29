# 301 - CSS Variable Extractor

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const parseCssVar = defineTool("parseCssVar", {
  description: "Parse a CSS line to extract custom property (CSS variable) declarations",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const match = line.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
    if (!match) return { name: "", value: "", found: false };
    return { name: match[1] ?? "", value: match[2] ?? "", found: true };
  },
});

// Agent role: Scan CSS files to extract CSS custom property declarations and detect unused variables.
const cssVariableExtractor = agent({
  model: "small",
  instructions: p`Scan CSS files and extract all custom property (CSS variable) declarations.

CSS file content (declarations and usages):
${p.bash("find . -name '*.css' -not -path '*/node_modules/*' | head -20 | xargs grep -h -- '--' 2>/dev/null | head -100 || echo 'no css files'")}

Use the parseCssVar tool on each line that may contain a CSS variable declaration (--variable: value).
For each variable found, count how many times it appears as a usage (var(--name)).
A variable is unused if it is declared but never used via var().
Return the structured output.`,
  output: s.object({
    variables: s.record(s.object({
      value: s.string,
      usageCount: s.int,
    })),
    unusedVars: s.array(s.string),
    totalVars: s.int,
  }),
  tools: [parseCssVar],
  addons: [steering(), repair()],
});

export default cssVariableExtractor;
```
