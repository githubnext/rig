# 552 - Resource Schedule Partial Lookup

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: look up a reservoir's scheduled release window by station id from an embedded table.
const lookupReleaseWindow = defineTool("lookup_release_window", {
  description: "Look up the scheduled release window for a reservoir station by its station id.",
  parameters: s.object({
    stationId: s.string,
  }),
  handler: async ({ stationId }: { stationId: string }) => {
    const schedule: Record<string, string> = {
      "res-01": "06:00-08:00",
      "res-02": "08:00-10:00",
      "res-03": "10:00-12:00",
      "res-04": "12:00-14:00",
      "res-05": "14:00-16:00",
      "res-06": "16:00-18:00",
      "res-07": "18:00-20:00",
      "res-08": "20:00-22:00",
      "res-09": "22:00-00:00",
      "res-10": "00:00-02:00",
    };
    const window = schedule[stationId];
    return { window: window === undefined ? undefined : window };
  },
});

// Agent role: reconcile a fixed irrigation schedule against only the stations
// it manages to query via the lookup tool before its turn budget runs out.
const resourceScheduleReconciler = agent({
  model: "small",
  maxTurns: 4,
  tools: [lookupReleaseWindow],
  instructions: p`The irrigation resource schedule requires release windows for
    these ten station ids, in this exact order:
    res-01, res-02, res-03, res-04, res-05, res-06, res-07, res-08, res-09, res-10

    Every one of these station ids exists in the lookup table, so a resolved
    window is always available once you query it. Call lookup_release_window
    once per station id, strictly in the listed order, to fetch its window.
    You have a strict turn budget and will run out before you can query every
    station — this is expected. Do not rush or combine calls: query as many
    stations in order as your remaining turns allow, then stop calling the
    tool and produce your final answer immediately.

    Return resolvedWindows as one entry per station you successfully queried
    (stationId and window). Return unresolvedStationIds as the remaining
    station ids, in original order, that you ran out of turns to query before
    the budget ended — these are unresolved purely due to the turn budget, not
    because they are missing from the table.`,
  output: s.object({
    resolvedWindows: s.array(s.object({
      stationId: s.string,
      window: s.string,
    })),
    unresolvedStationIds: s.array(s.string),
  }),
});

export default resourceScheduleReconciler;
```
