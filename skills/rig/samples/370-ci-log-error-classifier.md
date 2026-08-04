# 370 - CI Log Error Classifier

```rig
import { agent, p, s, defineTool } from "rig";
import { repair } from "rig";

const classifyLogLine = defineTool("classifyLogLine", {
  description: "Classify a CI log line by error class and severity.",
  parameters: s.object({ lineNum: s.int, text: s.string }),
  handler: ({ lineNum, text }: { lineNum: number; text: string }) => {
    const lower = text.toLowerCase();
    let severity: "error" | "warning" | "info" = "info";
    if (/\b(error|fail|fatal|exception)\b/.test(lower)) severity = "error";
    else if (/\b(warn|warning|deprecated)\b/.test(lower)) severity = "warning";

    let errorClass: "compile" | "test" | "lint" | "network" | "permission" | "unknown" = "unknown";
    if (/\b(tsc|typescript|compile|syntax)\b/.test(lower)) errorClass = "compile";
    else if (/\b(test|jest|vitest|mocha|spec|assert)\b/.test(lower)) errorClass = "test";
    else if (/\b(eslint|lint|prettier|tslint)\b/.test(lower)) errorClass = "lint";
    else if (/\b(fetch|network|econnrefused|dns|timeout|socket)\b/.test(lower)) errorClass = "network";
    else if (/\b(eacces|eperm|permission|denied|unauthorized)\b/.test(lower)) errorClass = "permission";

    return { lineNum, errorClass, severity };
  },
});

// Agent role: classify CI log lines by error class and severity, then summarize.
const ciLogErrorClassifier = agent({
  model: "small",
  input: s.object({ logFile: s.string }),
  instructions: p`Read and classify each line of a CI log file.

Log file contents (input.logFile):
${p.readInput("logFile")}

Steps:
1. Split the content into lines and filter non-empty lines.
2. For each non-empty line (with its 1-based line number), call classifyLogLine.
3. Build the lines array with lineNum, text, errorClass, and severity.
4. Count errorCount (severity="error") and warningCount (severity="warning").
5. Set dominantError to the most common errorClass among error-severity lines, or omit if none.`,
  output: s.object({
    lines: s.array(s.object({
      lineNum: s.int,
      text: s.string,
      errorClass: s.enum("compile", "test", "lint", "network", "permission", "unknown"),
      severity: s.enum("error", "warning", "info"),
    })),
    errorCount: s.number,
    warningCount: s.number,
    dominantError: s.optional(s.string),
  }),
  tools: [classifyLogLine],
  maxTurns: 6,
  addons: [repair()],
});

export default ciLogErrorClassifier;
```
