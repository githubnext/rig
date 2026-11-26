# 579 - Date Typed Event Ledger

```rig
import { agent, p, s } from "rig";

const shotEvent = s.object({
  eventId: s.string,
  eventDate: s.date,
  shotLabel: s.string,
  observedDurationSec: s.nullable(s.number),
  note: s.nullable(s.string),
});
const ledger = s.object({
  events: s.array(shotEvent),
  summary: s.object({ count: s.int }),
});

// Agent role: turn a synthetic production timeline into a date-typed shot-event ledger.
const dateTypedEventLedger = agent({
  model: "large",
  instructions: p`Use only the synthetic timeline emitted by ${p.bash("printf '%s\\n' '2026-04-03|shot-001|Opening dolly|12.5|-' '2026-04-04|shot-002|Insert prop||Duration not fully observed' '2026-04-05|shot-003|Two-shot reaction|8.0|-'")}. Parse each source line into one event and preserve source order. Dates are date-only YYYY-MM-DD values. Keep partial observations: use null for an unavailable duration and put its explanation in note; use null note when no note exists. Return every line exactly once and set summary.count to the number of events. Output only the declared ledger.`,
  output: ledger,
});

export default dateTypedEventLedger;
```
