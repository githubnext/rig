# 577 - Transit Schedule Intersections

```rig
import { agent, defineTool, p, s } from "rig";

const intersections = defineTool("schedule_intersections", {
  description: "Compare every cross-source window pair at the same depot on the embedded timeline.",
  parameters: s.object({}),
  handler: async () => {
    const windows = [
      { sourceId: "dispatch", windowId: "d1", depot: "east", start: 1380, end: 1500 },
      { sourceId: "dispatch", windowId: "d2", depot: "east", start: 1500, end: 1560 },
      { sourceId: "dispatch", windowId: "d3", depot: "west", start: 120, end: 180 },
      { sourceId: "dispatch", windowId: "d4", depot: "south", start: 0, end: 60 },
      { sourceId: "operations", windowId: "o1", depot: "east", start: 1410, end: 1500 },
      { sourceId: "operations", windowId: "o2", depot: "east", start: 1500, end: 1530 },
      { sourceId: "operations", windowId: "o3", depot: "east", start: 1600, end: 1620 },
      { sourceId: "operations", windowId: "o4", depot: "west", start: 180, end: 200 },
      { sourceId: "operations", windowId: "o5", depot: "south", start: 200, end: 220 },
    ];
    const evidence = [];
    const nonConflicts = [];
    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const a = windows[i], b = windows[j];
        if (a.sourceId === b.sourceId || a.depot !== b.depot) continue;
        const pair = { depot: a.depot, sourceA: a.sourceId, windowA: a.windowId,
          sourceB: b.sourceId, windowB: b.windowId };
        const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
        if (start < end) evidence.push({ ...pair, start, end });
        else nonConflicts.push({ ...pair, reason: start === end ? "touching" : "separate" });
      }
    }
    return { evidence, nonConflicts, comparedPairs: evidence.length + nonConflicts.length };
  },
});

const pair = { depot: s.string, sourceA: s.string, windowA: s.string,
  sourceB: s.string, windowB: s.string };
// Agent role: report all interval evidence and account for non-overlapping pairs without selecting a source.
const transitScheduleIntersections = agent({
  model: "small",
  tools: [intersections],
  instructions: p`Timeline context: ${p.bash("printf 'Day 1 begins at minute 0; day 2 begins at minute 1440.'")}
    Call schedule_intersections once and return its complete result unchanged.
    Windows and overlap bounds are half-open absolute-minute intervals. An overnight
    window can cross minute 1440; touching endpoints do not overlap. comparedPairs
    counts only cross-source pairs at the same depot. Preserve every pair's source
    and window IDs; neither source is authoritative. Return only the declared output.`,
  output: s.object({
    evidence: s.array(s.object({ ...pair, start: s.int, end: s.int })),
    nonConflicts: s.array(s.object({ ...pair, reason: s.enum("touching", "separate") })),
    comparedPairs: s.int,
  }),
});

export default transitScheduleIntersections;
```
