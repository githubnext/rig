# 114 - Loc Statistics Gatherer

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: gather lines-of-code statistics per file extension.
const locStatisticsGatherer = agent({
  model: "mini",
  instructions: p`Count lines of code by file extension in this workspace.

Source files found:
${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' \\( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' -o -name '*.rs' \\) 2>/dev/null | head -200")}

Line counts:
${p.bash("find . -not -path '*/node_modules/*' -not -path '*/.git/*' \\( -name '*.ts' -o -name '*.js' -o -name '*.py' \\) -exec wc -l {} + 2>/dev/null | tail -5")}

Use the classifyComplexity tool to determine overall complexity. Aggregate results by extension.
Return only the declared output.`,
  tools: [
    defineTool("classifyComplexity", {
      description: "Classify total line count into complexity bucket",
      parameters: s.object({ totalLines: s.int }),
      handler({ totalLines }) {
        if (totalLines < 1000) return "small";
        if (totalLines < 10000) return "medium";
        if (totalLines < 100000) return "large";
        return "xlarge";
      },
    }),
  ],
  output: s.object({
    byExtension: s.record(s.object({ lineCount: s.int, fileCount: s.int })),
    totalLines: s.int,
    complexity: s.enum("small", "medium", "large", "xlarge"),
  }),
});

export default locStatisticsGatherer;
```
