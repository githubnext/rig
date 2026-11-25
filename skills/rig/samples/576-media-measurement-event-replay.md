# 576 - Media Measurement Event Replay

```rig
import { agent, p, s, workflow } from "rig";

type Event = { id: string; shot: string; revision: number; durationSec: number };
type Disposition = "applied" | "duplicate" | "deferred" | "rejected";
type Audit = { index: number; id: string; disposition: Disposition; reason: string };
const eventSchema = s.object({ id: s.string, shot: s.string, revision: s.int, durationSec: s.number });

// Agent role: extract every delivered measurement event without deduplication or reordering.
const extractor = agent({
  model: "small",
  instructions: p`Extract every CSV row, preserving order and repeated IDs. Map event_id to id and duration_sec to durationSec: ${p.bash("printf '%s\\n' 'event_id,shot,revision,duration_sec' 'a2,A,2,12.5' 'a1,A,1,11.5' 'a1,A,1,11.5' 'b3,B,3,23.5' 'reuse,A,3,13.5' 'reuse,B,1,21.5'")}`,
  output: s.object({ events: s.array(eventSchema) }),
});

// Workflow role: extract a batch and replay it twice against versioned measurement state.
const replay = workflow({
  meta: { name: "media-measurement-event-replay", description: "Apply consecutive shot revisions idempotently", phases: ["Extract", "First replay", "Second replay"] },
  body: async ({ call, phase }) => {
    const baseline = [{ shot: "A", revision: 0, durationSec: 10 }, { shot: "B", revision: 0, durationSec: 20 }];
    const state = new Map(baseline.map((row) => [row.shot, { ...row }]));
    const appliedLedger = new Map<string, string>();
    const signature = (e: Event) => JSON.stringify([e.shot, e.revision, e.durationSec]);
    const snapshot = () => [...state.values()].map((row) => ({ ...row })).sort((a, b) => a.shot < b.shot ? -1 : a.shot > b.shot ? 1 : 0);
    const result = (status: string, audit: Audit[]) => ({ status, snapshot: snapshot(), applied: audit.filter((a) => a.disposition === "applied").map((a) => a.id), duplicate: audit.filter((a) => a.disposition === "duplicate").map((a) => a.id), deferred: audit.filter((a) => a.disposition === "deferred").map((a) => a.id), rejected: audit.filter((a) => a.disposition === "rejected").map((a) => a.id), audit });
    const apply = (events: Event[]) => {
      const audit: Audit[] = [];
      const groups = new Map<string, { event: Event; indices: number[]; signatures: Set<string> }>();
      events.forEach((event, index) => {
        const group = groups.get(event.id) ?? { event, indices: [], signatures: new Set<string>() };
        group.indices.push(index); group.signatures.add(signature(event)); groups.set(event.id, group);
      });
      const candidates: { event: Event; indices: number[] }[] = [];
      const mark = (indices: number[], id: string, disposition: Disposition, reason: string) => indices.forEach((index) => audit.push({ index, id, disposition, reason }));
      for (const [id, group] of groups) {
        const e = group.event, previous = appliedLedger.get(id), sig = signature(e);
        if (group.signatures.size !== 1 || (previous !== undefined && previous !== sig)) mark(group.indices, id, "rejected", "conflicting event ID reuse");
        else if (previous !== undefined) mark(group.indices, id, "duplicate", "already applied");
        else if (!id || !state.has(e.shot) || e.revision <= state.get(e.shot)!.revision || !Number.isFinite(e.durationSec)) mark(group.indices, id, "rejected", "invalid shot, ID, revision, or measurement");
        else candidates.push(group);
      }
      const revisionCounts = new Map<string, number>();
      for (const { event: e } of candidates) { const key = JSON.stringify([e.shot, e.revision]); revisionCounts.set(key, (revisionCounts.get(key) ?? 0) + 1); }
      candidates.sort((a, b) => a.event.shot < b.event.shot ? -1 : a.event.shot > b.event.shot ? 1 : a.event.revision - b.event.revision);
      for (const { event: e, indices } of candidates) {
        if (revisionCounts.get(JSON.stringify([e.shot, e.revision]))! > 1) { mark(indices, e.id, "rejected", "multiple IDs for one shot revision"); continue; }
        const current = state.get(e.shot)!;
        if (e.revision !== current.revision + 1) mark([indices[0]], e.id, "deferred", "missing preceding revision");
        else { state.set(e.shot, { shot: e.shot, revision: e.revision, durationSec: e.durationSec }); appliedLedger.set(e.id, signature(e)); mark([indices[0]], e.id, "applied", "consecutive revision"); }
        mark(indices.slice(1), e.id, "duplicate", "identical delivery within batch");
      }
      return result("ok", audit.sort((a, b) => a.index - b.index));
    };
    phase("Extract");
    const extracted = await call(extractor, "Extract the measurement event batch.", { label: "extract" });
    phase("First replay");
    const first = extracted === null ? result("extraction-failed", []) : apply(extracted.events);
    phase("Second replay");
    const second = extracted === null ? result("extraction-failed", []) : apply(extracted.events);
    return { baseline, first, second };
  },
});

export default replay;
```
