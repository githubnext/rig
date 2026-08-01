# 342 - Config Drift Reconciler V2

```rig
import { agent, p, s, defineTool } from "rig";

// Agent role: Compare a baseline config file against an active config file, write a corrected patch, and return a diff summary.
const configDriftReconciler = agent({
  model: "small",
  input: s.object({
    baselineFile: s.string,
    activeFile: s.string,
    outputPatch: s.string,
  }),
  instructions: p`You are a config drift reconciler.

Baseline config:
${p.readInput("baselineFile")}

Active config:
${p.readInput("activeFile")}

${defineTool("diffConfigs", {
  description: "Compare two JSON config strings and return changed keys",
  parameters: s.object({ baseline: s.string, active: s.string }),
  handler: (args) => {
    let baseObj: Record<string, unknown> = {};
    let activeObj: Record<string, unknown> = {};
    try { baseObj = JSON.parse(args.baseline); } catch {}
    try { activeObj = JSON.parse(args.active); } catch {}
    const keys = new Set([...Object.keys(baseObj), ...Object.keys(activeObj)]);
    const changed: Record<string, { baseline: unknown; actual: unknown }> = {};
    for (const k of keys) {
      if (JSON.stringify(baseObj[k]) !== JSON.stringify(activeObj[k])) {
        changed[k] = { baseline: baseObj[k], actual: activeObj[k] };
      }
    }
    return { changed, totalChecked: keys.size, totalDrifted: Object.keys(changed).length };
  },
})}

Compare the configs, write a patch to the output file, and return the diff summary.
${p.writeOutput("outputPatch", "outputPatch")}`,
  output: s.object({
    changedKeys: s.record(s.object({ baseline: s.unknown, actual: s.unknown })),
    summary: s.object({
      totalDrifted: s.int,
      totalChecked: s.int,
      normalized: s.boolean,
    }),
  }),
});

export default configDriftReconciler;
```
