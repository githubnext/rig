# 582 - Linked Sports Unit Converter

```rig
import { agent, defineTool, p, s } from "rig";

const resolveSportsSegment = defineTool("resolve_sports_segment", {
  description: "Resolve a linked match segment and convert its miles to kilometers.",
  parameters: s.object({
    matchId: s.string,
    segmentId: s.string,
  }),
  handler: async ({ matchId, segmentId }: { matchId: string; segmentId: string }) => {
    const matches: Array<{ id: string; segmentIds: string[] }> = [
      { id: "match-101", segmentIds: ["seg-a", "seg-orphan"] },
      { id: "match-202", segmentIds: ["seg-b"] },
    ];
    const segments: Array<{ id: string; miles: number; laps: number }> = [
      { id: "seg-a", miles: 3.1, laps: 2 },
      { id: "seg-b", miles: 5, laps: 0 },
    ];
    const match = matches.find((row: { id: string; segmentIds: string[] }) => row.id === matchId);
    if (!match) return { matchId, segmentId, lapCount: 0, segmentCount: 0, distanceKilometers: null, missingLinkReason: `match ${matchId} not found` };
    if (!match.segmentIds.includes(segmentId)) return { matchId, segmentId, lapCount: 0, segmentCount: 0, distanceKilometers: null, missingLinkReason: `segment ${segmentId} is not linked from match ${matchId}` };
    const segment = segments.find((row: { id: string; miles: number; laps: number }) => row.id === segmentId);
    if (!segment) return { matchId, segmentId, lapCount: 0, segmentCount: 0, distanceKilometers: null, missingLinkReason: `segment ${segmentId} not found` };
    return { matchId, segmentId, lapCount: segment.laps, segmentCount: 1, distanceKilometers: Number((segment.miles * 1.60934).toFixed(3)), missingLinkReason: null };
  },
});

// Agent role: resolve embedded match/segment links, convert distances, and preserve dangling-link reasons.
const linkedSportsUnitConverter = agent({
  model: "small",
  tools: [resolveSportsSegment],
  instructions: p`Call resolve_sports_segment once for each embedded pair:
    match-101/seg-a, match-101/seg-orphan, match-202/seg-b, match-404/seg-a.
    Return one row per pair, copying IDs, lapCount, segmentCount,
    distanceKilometers, and missingLinkReason from the tool. Successful rows
    have converted kilometers and a null reason. Missing links have zero counts,
    null distanceKilometers, and preserve the tool's explicit reason.`,
  output: s.array(s.object({
    matchId: s.string,
    segmentId: s.string,
    lapCount: s.nonNegativeInt,
    segmentCount: s.nonNegativeInt,
    distanceKilometers: s.nullable(s.number),
    missingLinkReason: s.nullable(s.string),
  })),
});

export default linkedSportsUnitConverter;
```
