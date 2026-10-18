# 557 - Parallel Timeline Conflict Flagger

```rig
import { agent, p, s, workflow } from "rig";

const timelineEvent = s.object({ timestamp: s.string, kwh: s.number });
// Agent role: parse the smart-meter export timeline into structured kWh readings.
const smartMeterParser = agent({
  model: "small",
  instructions: p`Smart-meter export (timestamp, kWh), one reading per line:
    ${p.bash(`cat <<'EOF'
2024-05-01 00:00:00Z, 1.20
2024-05-01 01:00:00Z, 0.95
2024-05-01 03:00:00Z, 1.10
2024-05-01 04:00:00Z, 0.80
2024-05-01 05:00:00Z, 1.50
EOF`)}
    Parse each line into a reading, exactly as logged. Return the declared output.`,
  output: s.array(timelineEvent),
});
// Agent role: parse the utility billing export timeline into structured kWh readings.
const billingParser = agent({
  model: "small",
  instructions: p`Utility billing export (timestamp, kWh), one reading per line:
    ${p.bash(`cat <<'EOF'
2024-05-01 00:00:00Z, 1.20
2024-05-01 01:00:00Z, 1.15
2024-05-01 04:00:00Z, 0.80
2024-05-01 06:00:00Z, 0.65
EOF`)}
    Parse each line into a reading, exactly as logged. Return the declared output.`,
  output: s.array(timelineEvent),
});
// Workflow role: fan out over both timelines in parallel, then reconcile by
// timestamp (agree-once, flag disagreements, pass through single-source).
const parallelTimelineConflictFlagger = workflow({
  meta: {
    name: "parallel-timeline-conflict-flagger",
    description: "Fan out over smart-meter and billing timelines, flag timestamp disagreements instead of merging",
    phases: ["Parse", "Reconcile"],
  },
  body: async ({ call, phase }) => {
    phase("Parse");
    const [meterEvents, billEvents] = await Promise.all([
      call(smartMeterParser, "parse smart-meter export"),
      call(billingParser, "parse billing export"),
    ]);
    phase("Reconcile");
    const meterMap = new Map((meterEvents ?? []).map((e) => [e.timestamp, e.kwh]));
    const billMap = new Map((billEvents ?? []).map((e) => [e.timestamp, e.kwh]));
    const reconciledEvents: { timestamp: string; kwh: number; source: string }[] = [];
    const flaggedConflicts: { timestamp: string; smartMeterKwh: number; billingKwh: number }[] = [];
    for (const ts of new Set([...meterMap.keys(), ...billMap.keys()])) {
      const m = meterMap.get(ts), b = billMap.get(ts);
      if (m !== undefined && b !== undefined && m === b) reconciledEvents.push({ timestamp: ts, kwh: m, source: "agreed" });
      else if (m !== undefined && b !== undefined) flaggedConflicts.push({ timestamp: ts, smartMeterKwh: m, billingKwh: b });
      else if (m !== undefined) reconciledEvents.push({ timestamp: ts, kwh: m, source: "smart-meter" });
      else if (b !== undefined) reconciledEvents.push({ timestamp: ts, kwh: b, source: "billing" });
    }
    return { reconciledEvents, flaggedConflicts };
  },
});
export default parallelTimelineConflictFlagger;
```
