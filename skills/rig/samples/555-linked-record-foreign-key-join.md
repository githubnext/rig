# 555 - Linked Record Foreign Key Join

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: join a reading (experimentId+runId) to its calibration by calibrationId;
// return adjusted value, or null with a reason when the foreign key is dangling.
const resolveAdjustedReading = defineTool("resolve_adjusted_reading", {
  description: "Join a reading record to its calibration record by calibrationId and compute the adjusted value.",
  parameters: s.object({ experimentId: s.string, runId: s.string }),
  handler: async ({ experimentId, runId }: { experimentId: string; runId: string }) => {
    const readings = [
      { experimentId: "exp-a", runId: "run-1", value: 10.5, calibrationId: "cal-1" },
      { experimentId: "exp-a", runId: "run-2", value: 11.2, calibrationId: "cal-2" },
      { experimentId: "exp-b", runId: "run-1", value: 9.8, calibrationId: "cal-9" },
      { experimentId: "exp-b", runId: "run-2", value: 12.1, calibrationId: "cal-3" },
      { experimentId: "exp-c", runId: "run-1", value: 8.4, calibrationId: "cal-1" },
    ];
    const calibrations: Record<string, number> = { "cal-1": 0.5, "cal-2": -0.3, "cal-3": 1.1 };
    const reading = readings.find((r) => r.experimentId === experimentId && r.runId === runId);
    if (!reading) {
      return { rawValue: 0, adjustedValue: null, adjustmentReason: `reading not found for ${experimentId}/${runId}` };
    }
    const offset = calibrations[reading.calibrationId];
    if (offset === undefined) {
      return { rawValue: reading.value, adjustedValue: null, adjustmentReason: `calibration record not found for calibrationId ${reading.calibrationId}` };
    }
    return { rawValue: reading.value, adjustedValue: reading.value + offset, adjustmentReason: null };
  },
});

// Agent role: resolve each embedded experiment/run pair through the foreign-key join tool and summarize results.
const linkedRecordForeignKeyJoiner = agent({
  model: "small",
  tools: [resolveAdjustedReading],
  instructions: p`Resolve these experiment/run pairs:
    - "exp-a"/"run-1", "exp-a"/"run-2", "exp-b"/"run-1", "exp-b"/"run-2", "exp-c"/"run-1"

    For each pair, call resolve_adjusted_reading with its experimentId and runId.
    The tool joins the reading's calibrationId against a separate calibrations
    table. If that calibrationId is missing (a dangling foreign key), the tool
    returns adjustedValue: null plus a non-null adjustmentReason naming the
    missing calibrationId; keep that reason verbatim. Otherwise adjustmentReason
    must be null. Return one entry per pair with experimentId, runId, rawValue,
    adjustedValue, and adjustmentReason exactly as reported by the tool.`,
  output: s.array(s.object({
    experimentId: s.string,
    runId: s.string,
    rawValue: s.number,
    adjustedValue: s.nullable(s.number),
    adjustmentReason: s.nullable(s.string),
  })),
});

export default linkedRecordForeignKeyJoiner;
```
