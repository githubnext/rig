# 176 - CSS Variable Extractor

```rig
import { agent, p, s } from "rig";
import { defineTool } from "rig";

const parseCssVar = defineTool("parseCssVar", {
  description: "Parse a CSS custom property declaration line and extract name and value",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const match = line.match(/(--[\w-]+)\s*:\s*(.+?)\s*;?$/);
    if (!match) return null;
    return { name: match[1], value: match[2].trim() };
  },
});

// Agent role: extract CSS custom properties and identify unused variables.
const cssVariableExtractor = agent({
  model: "small",
  tools: [parseCssVar],
  instructions: p`Find CSS/SCSS files: ${p.bash("find . -name '*.css' -o -name '*.scss' 2>/dev/null | grep -v node_modules | head -20")}. Extract declarations: ${p.bash("grep -rh --include='*.css' --include='*.scss' -- '--[a-z]' . 2>/dev/null | grep -v node_modules | head -100")}. Also scan for usages: ${p.bash("grep -roh --include='*.css' --include='*.scss' --include='*.ts' --include='*.tsx' -- 'var(--[^)]+)' . 2>/dev/null | grep -o -- '--[^)]*' | sort | uniq -c | sort -rn | head -50")}. Use parseCssVar to parse each declaration line. For each variable track value and usage count. Identify unused variables (declared but never used).`,
  output: s.object({
    variables: s.record(s.object({
      value: s.string,
      usageCount: s.int,
    })),
    totalVars: s.int,
    unusedVars: s.array(s.string),
  }),
});

export default cssVariableExtractor;
```
