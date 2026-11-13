# 563 - Parallel Branch Timeout Holes

```rig
import { p, s, workflow } from "rig";

const reading = s.object({
  meterId: s.string,
  source: s.string,
  kwh: s.number,
  conflictNote: s.string,
});

// Workflow role: reconcile energy meter readings from conflicting nested catalogs in parallel, each branch with its own timeout, and report null holes.
const energyMeterReconciler = workflow({
  meta: {
    name: "parallel-branch-timeout-holes",
    description: "Per-branch timeouts inside parallel() leave null holes for slow energy-usage sources",
    phases: ["Read", "Report"],
  },
  body: async ({ call, parallel, phase }) => {
    phase("Read");
    const sources = [
      { name: "utility-billing", catalog: "catalog/billing/north: meter M-17 = 412 kWh, meter M-18 = 380 kWh", timeout: 20_000 },
      { name: "smart-meter-feed", catalog: "catalog/iot/hub-2: meter M-17 = 398 kWh, meter M-18 = 391 kWh", timeout: 20_000 },
      { name: "manual-survey", catalog: "catalog/field/legacy: meter M-17 = 450 kWh, meter M-18 missing (very long handwritten ledger)", timeout: 1_500 },
    ];
    const results = await parallel(
      sources.map((src) => () =>
        call.json(
          p`Source ${src.name} (nested catalog entry): ${src.catalog}. Extract the reading for meter M-17 and note in conflictNote how it may conflict with other sources such as utility-billing (412) or smart-meter-feed (398).`,
          reading,
          { label: src.name, timeout: src.timeout },
        ),
      ),
    );
    phase("Report");
    const present = results.flatMap((r, i) => (r ? [{ ...r, branch: sources[i]!.name }] : []));
    const holes = results.flatMap((r, i) => (r === null ? [sources[i]!.name] : []));
    return call.json(
      p`Reconcile energy usage for meter M-17 from these readings: ${JSON.stringify(present)}. Branches that timed out or failed (null holes): ${JSON.stringify(holes)}. Pick a reconciled kWh, explain the conflict, and list the missing sources.`,
      s.object({
        meterId: s.string,
        reconciledKwh: s.number,
        conflictExplanation: s.string,
        missingSources: s.array(s.string),
        holeCount: s.int,
      }),
      { label: "reconcile" },
    );
  },
});

export default energyMeterReconciler;
```
