# 564 - Multilingual Event Timeline Manifest

```rig
import { agent, p, s } from "rig";

const localeCode = s.enum("en", "es", "fr", "ja");
const eventId = s.enum("evt-001", "evt-002", "evt-003", "evt-004", "evt-005");

// Agent role: preserve archive chronology while localizing labels per locale.
const archiveTimelineLocalizer = agent({
  model: "large",
  instructions: p`Use this archive source note: ${p.bash("printf '%s' 'The representative event set is embedded below.'")}

Canonical archive events, in immutable order:
- evt-001: 1898 — Lantern catalog issued
- evt-002: 1912 — River ferry photograph acquired
- evt-003: 1945 — Oral-history reel digitized
- evt-004: 1976 — Map restoration completed
- evt-005: 2008 — Community archive opened

Return exactly one record keyed by "en", "es", "fr", and "ja". For every locale, set locale to its code, eventIds to exactly ["evt-001", "evt-002", "evt-003", "evt-004", "evt-005"], and labels to five objects in that same order with matching eventId values and translated labels. Use null when a translation is unavailable. Put every null-label event ID, and no others, in missingLabelEventIds. Representative gaps: es lacks evt-004, fr lacks evt-003, ja lacks evt-002 and evt-005, and en has none. Never reorder or omit events.`,
  output: s.record(
    s.object({
      locale: localeCode,
      eventIds: s.array(eventId),
      labels: s.array(s.object({
        eventId: eventId,
        label: s.nullable(s.string),
      })),
      missingLabelEventIds: s.array(eventId),
    }),
  ),
});

export default archiveTimelineLocalizer;
```
