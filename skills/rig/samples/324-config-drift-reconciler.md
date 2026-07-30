# 324 - Config Drift Reconciler

```rig
import { agent, p, s } from "rig";

// Agent role: compare a baseline config file against an active config, identify drifted keys, and write a reconciled patch.
const configDriftReconciler = agent({
  model: "small",
  input: s.object({
    baseFile: s.path,
    activeFile: s.path,
    outputFile: s.path,
  }),
  instructions: p`Compare the baseline config file against the active config file.
Baseline: ${p.readInput("baseFile")}
Active: ${p.readInput("activeFile")}
Identify keys that have drifted (changed values). Write a corrected patch to the output file: ${p.writeInput("outputFile", "patch")}
Return the changed keys and a summary.`,
  output: s.object({
    changedKeys: s.record(s.object({
      baseline: s.unknown,
      actual: s.unknown,
    })),
    summary: s.object({
      totalDrifted: s.int,
      totalChecked: s.int,
      normalized: s.boolean,
    }),
  }),
});

export default configDriftReconciler;
```
