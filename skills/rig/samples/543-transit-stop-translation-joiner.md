# 543 - Transit Stop Translation Joiner

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: look up a translated label for a stop in a given locale from an embedded table.
const lookupTranslation = defineTool("lookup_translation", {
  description: "Look up the translated label for a transit stop in a given locale.",
  parameters: s.object({
    stopId: s.string,
    locale: s.string,
  }),
  handler: async ({ stopId, locale }: { stopId: string; locale: string }) => {
    const table: Record<string, Record<string, string>> = {
      "stop-1": { en: "Central Station", fr: "Gare Centrale" },
      "stop-2": { en: "Market Square" },
      "stop-3": { en: "Riverside", fr: "Bord de Riviere" },
      "stop-4": { en: "Harbor View" },
    };
    const label = table[stopId]?.[locale];
    return { label: label === undefined ? undefined : label };
  },
});

// Agent role: join embedded transit stops against French translations, mapping missing lookups to null.
const transitStopTranslationJoiner = agent({
  model: "small",
  tools: [lookupTranslation],
  instructions: p`Here are the transit stops with their route IDs:
    - stop-1: routes ["R1", "R2"]
    - stop-2: routes ["R3"]
    - stop-3: routes ["R2", "R4"]
    - stop-4: routes ["R5"]

    For each stop, call lookup_translation with its stopId and locale "fr" to
    find its French label. If the tool returns no label (the label field is
    absent/undefined), set the output label to null for that stop rather than
    omitting it. Return one entry per stop joining its stopId, routeIds, and
    resolved label (string or null).`,
  output: s.array(
    s.object({
      stopId: s.string,
      routeIds: s.array(s.string),
      label: s.nullable(s.string),
    }),
  ),
});

export default transitStopTranslationJoiner;
```
