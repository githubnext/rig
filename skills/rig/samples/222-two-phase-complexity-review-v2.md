# 222 - Two Phase Complexity Review V2

```rig
import { agent, p, s } from "rig";

// Agent role: extract TypeScript function names and approximate line counts from source files.
const extractor = agent({
  name: "extractor",
  model: "small",
  instructions: p`Scan TypeScript source files for function definitions: ${p.bash("grep -rn --include='*.ts' 'function \\|=> {\\|async ' . | grep -v node_modules | grep -v '.test.' | head -60 2>/dev/null || echo 'no ts files'")}. For each distinct function name found, estimate its line count from context. Return an array of objects with functionName, lineCount, and file.`,
  output: s.array(s.object({
    functionName: s.string,
    lineCount: s.int,
    file: s.path,
  })),
});

// Agent role: rate each extracted function for complexity and produce a summary.
const reviewer = agent({
  name: "reviewer",
  model: "small",
  instructions: p`You will receive a list of functions with their line counts. Classify each as: simple (<10 lines), moderate (10-29), complex (30-59), or critical (≥60). Return one rating object per function plus a summary with total and complex+critical count.`,
  output: s.object({
    analysis: s.record(s.object({
      lineCount: s.int,
      complexity: s.enum("simple", "moderate", "complex", "critical"),
    })),
    summary: s.object({
      totalFunctions: s.int,
      complexCount: s.int,
    }),
  }),
  agents: { extractor },
});

export default reviewer;
```
