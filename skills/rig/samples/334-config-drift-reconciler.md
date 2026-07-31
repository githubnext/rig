# 334 - Config Drift Reconciler

```rig
import { agent, p, s } from "rig";

// Agent role: compare baseline and active config, write a corrected patch, and report drifted keys.
const configDriftReconciler = agent({
  model: "small",
  instructions: p`Baseline config:
${p.readOptional("config/baseline.json", "{}")}

Active config:
${p.readOptional("config/active.json", "{}")}

Compare the two configs. For each key that differs, record baseline and actual values.
Produce a patch JSON with corrections and return the analysis.
${p.writeOutput("patch", "config/patch.json")}`,
  output: s.object({
    patch: s.string,
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
  maxTurns: 4,
});

export default configDriftReconciler;
```
