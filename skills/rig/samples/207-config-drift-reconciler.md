# 207 - Config Drift Reconciler

```rig
import { agent, p, s } from "rig";

// Agent role: compare two config files, identify drifted settings, and write a corrected patch.
const configDriftReconciler = agent({
  model: "small",
  instructions: p`Read the baseline ESLint config: ${p.readOptional(".eslintrc.json", "{}")}. Read the active config: ${p.readOptional(".eslintrc.js", "module.exports = {}")}. Also check for any local overrides: ${p.bash("find . -maxdepth 2 -name '.eslintrc*' -not -path '*/node_modules/*' 2>/dev/null || true")}. Identify keys that differ between the baseline and active configs. Write a normalized patch to ${p.write("config-patch.json", "PATCH_CONTENT")} showing the corrected settings. Report each drifted key with its baseline and actual value. Set normalized to true if you were able to resolve all differences.`,
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
