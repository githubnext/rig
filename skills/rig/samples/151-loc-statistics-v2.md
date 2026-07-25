# 151 - Loc Statistics V2

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: gather lines-of-code statistics per file extension.
const locStatisticsV2 = agent({
  model: "small",
  instructions: p`Count lines of code per file extension in this workspace.

TypeScript files found:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -50")}

Line counts for TypeScript files:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' | head -20 | xargs wc -l 2>/dev/null | tail -1")}

JavaScript files found:
${p.bash("find . -name '*.js' -not -path '*/node_modules/*' | head -20")}

Use the aggregateExtension tool to compute totals. Then classify complexity for each
extension: xlarge > 10000 lines, large > 5000, medium > 1000, small otherwise.
Return a record keyed by extension (e.g. ".ts", ".js") with lineCount, fileCount,
and complexity.`,
  tools: [
    defineTool("aggregateExtension", {
      description: "Count lines in files matching a given extension",
      parameters: s.object({ extension: s.string, sampleFile: s.string }),
      async handler({ extension, sampleFile }) {
        const { execSync } = await import("node:child_process");
        try {
          const count = execSync(
            `find . -name '*${extension}' -not -path '*/node_modules/*' | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}'`,
            { encoding: "utf-8" }
          ).trim();
          const files = execSync(
            `find . -name '*${extension}' -not -path '*/node_modules/*' | wc -l`,
            { encoding: "utf-8" }
          ).trim();
          return { extension, lineCount: parseInt(count) || 0, fileCount: parseInt(files) || 0, sampleFile };
        } catch {
          return { extension, lineCount: 0, fileCount: 0, sampleFile };
        }
      },
    }),
  ],
  output: s.record(
    s.object({
      lineCount: s.int,
      fileCount: s.int,
      complexity: s.enum("small", "medium", "large", "xlarge"),
    })
  ),
});

export default locStatisticsV2;
```
