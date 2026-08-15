# 416 - Ci Log Error Classifier

```rig
import { agent, defineTool, p, repair, s } from "rig";

const classifyLogLine = defineTool("classifyLogLine", {
  description: "Classify a CI log line into an error class and severity.",
  parameters: s.object({ line: s.string }),
  handler({ line }: { line: string }) {
    const lower = line.toLowerCase();
    const errorClass =
      lower.includes("error") && (lower.includes("compil") || lower.includes("syntax") || lower.includes("tsc"))
        ? ("compile" as const)
        : lower.includes("test") && (lower.includes("fail") || lower.includes("error"))
          ? ("test" as const)
          : lower.includes("eslint") || lower.includes("lint")
            ? ("lint" as const)
            : lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("network")
              ? ("network" as const)
              : lower.includes("permission") || lower.includes("eacces")
                ? ("permission" as const)
                : ("unknown" as const);
    const severity =
      lower.includes("error") ? ("error" as const)
        : lower.includes("warn") ? ("warning" as const)
          : ("info" as const);
    return { errorClass, severity };
  },
});

// Agent role: classify each line of a CI log file by error class and severity.
const ciLogErrorClassifier = agent({
  model: "small",
  input: s.object({ logFile: s.string }),
  instructions: p`Classify lines in the CI log file at the path provided in logFile.

Log content:
${p.readInput("logFile")}

For each non-empty line, call classifyLogLine. Build the lines array. Compute errorCount (lines with severity "error"), warningCount (lines with severity "warning"). dominantError = the most frequent errorClass among error-severity lines (omit if none).`,
  output: s.object({
    lines: s.array(s.object({
      line: s.string,
      errorClass: s.enum("compile", "test", "lint", "network", "permission", "unknown"),
      severity: s.enum("error", "warning", "info"),
    })),
    errorCount: s.number,
    warningCount: s.number,
    dominantError: s.optional(s.string),
  }),
  tools: [classifyLogLine],
  addons: [repair()],
});

export default ciLogErrorClassifier;
```
