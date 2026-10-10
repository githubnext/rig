# 537 - Line Count Report Writer

```rig
import { agent, p, s } from "rig";

// Agent role: count lines per TypeScript source file and write a markdown report.
const lineCountReport = agent({
  model: "small",
  instructions: p`Run ${p.bash("find src -name '*.ts' -exec wc -l {} +")} to get
    per-file line counts. Compose a markdown report summarizing the counts per
    file and the total, then ${p.writeOutput("report", "/tmp/gh-aw/agent/line-count-report.md")}.
    Return the report path, the total line count across all files, and the
    number of files counted.`,
  output: s.object({
    report: s.string,
    reportPath: s.path,
    totalLines: s.int,
    fileCount: s.int,
  }),
});

export default lineCountReport;
```
