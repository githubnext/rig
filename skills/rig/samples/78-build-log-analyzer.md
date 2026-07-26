# 78 - Build Log Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: run the build and analyze the output for errors, warnings, and success status.
const buildLogAnalyzer = agent({
  model: "small",
  instructions: p`Run the build command and analyze its output: ${p.bash("npm run build 2>&1 || true")}. Extract all errors and warnings with their severity and file location if available. Determine whether the build succeeded overall.`,
  output: s.object({
    errors: s.array(s.object({
      message: s.string,
      file: s.optional(s.string),
      severity: s.enum("error", "warning", "info"),
    })),
    buildSucceeded: s.boolean,
    summary: s.string,
  }),
  maxTurns: 5,
});

export default buildLogAnalyzer;
```
