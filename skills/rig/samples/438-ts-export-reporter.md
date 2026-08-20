# 438 - TS Export Reporter

```rig
import { agent, p, s } from "rig";

// Agent role: Count exported functions per TypeScript file and write a JSON report.
const tsExportReporter = agent({
  model: "small",
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. Count exported functions in each file: ${p.bash("grep -rc 'export function\\|export const.*=.*=>' src/ 2>/dev/null || echo ''")}. Write the report: ${p.writeOutput("reportPath", "export-report.json")}. Return the summary.`,
  output: s.object({
    fileCount: s.int,
    reportPath: s.path,
    topExporter: s.optional(s.string),
  }),
});

export default tsExportReporter;
```
