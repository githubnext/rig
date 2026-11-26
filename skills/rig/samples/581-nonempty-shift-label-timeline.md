# 581 - Nonempty Shift Label Timeline

```rig
import { agent, p, s } from "rig";

const eventId = s.enum("evt-001", "evt-002", "evt-003");
const locale = s.enum("en", "es", "ja");
const shiftEvent = s.object({
  eventId,
  timestamp: s.optional(s.string),
  label: s.nullable(s.string),
  translatedLabels: s.nonEmptyArray(s.object({ locale, label: s.string })),
});

// Agent role: parse synthetic manufacturing shift events and enforce multilingual evidence.
const parseShiftEvents = agent({
  model: "large",
  instructions: p`Parse only these synthetic local shift-event lines from ${p.bash("printf '%s\\n' 'evt-001|2026-11-26T06:00Z|Shift started|en=Shift started|es=Inicio del turno' 'evt-002|2026-11-26T10:15Z|Maintenance pause|en=Maintenance pause|ja=保守休止' 'evt-003||Shift resumed|en=Shift resumed|es=Turno reanudado|ja=シフト再開'")}. Each line is eventId|timestamp|label|locale=translation. Preserve input order. Omit a blank timestamp, use null only for an absent label, and ensure every event has a timestamp or label. Populate translatedLabels with every supplied locale/label object; it must never be empty. Expected locales are en, es, and ja. Put each missing event/locale pair in localeGaps and return only the declared output.`,
  output: s.object({
    events: s.array(shiftEvent),
    localeGaps: s.array(s.object({ eventId, locale })),
  }),
});

export default parseShiftEvents;
```
