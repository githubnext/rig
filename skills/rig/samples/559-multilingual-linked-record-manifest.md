# 559 - Multilingual Linked Record Manifest

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: resolve a shot's scene, then return labels/missingLocales for the requested locale set.
const resolveSubtitleCues = defineTool("resolve_subtitle_cues", {
  description: "Resolve subtitle cue labels for a shot across a set of requested locale codes.",
  parameters: s.object({
    shotId: s.string,
    locales: s.array(s.string),
  }),
  handler: async ({ shotId, locales }: { shotId: string; locales: string[] }) => {
    const shots: Record<string, string> = {
      "shot-1": "SC-10",
      "shot-2": "SC-20",
      "shot-3": "SC-10",
      "shot-4": "SC-30",
      "shot-5": "SC-20",
    };
    const scenes: Record<string, Record<string, string>> = {
      "SC-10": { en: "Dawn arrival", ja: "夜明けの到着", fr: "Arrivee a l'aube" },
      "SC-20": { en: "Market chase" },
      "SC-30": { en: "Final stand", ja: "最後の抵抗" },
    };
    const sceneId = shots[shotId];
    const record = sceneId ? scenes[sceneId] ?? {} : {};
    const labels: Record<string, string> = {};
    const missingLocales: string[] = [];
    for (const locale of locales) {
      const label = record[locale];
      if (label === undefined) missingLocales.push(locale);
      else labels[locale] = label;
    }
    return { labels, missingLocales };
  },
});

// Agent role: build a per-shot subtitle manifest by resolving the same locale set for every shot.
const multilingualSubtitleManifestBuilder = agent({
  model: "small",
  tools: [resolveSubtitleCues],
  instructions: p`Here are the shots to manifest, in order: shot-1, shot-2, shot-3,
    shot-4, shot-5.

    For each shot, call resolve_subtitle_cues exactly once with that shotId and
    locales set to ["en", "ja"] (always the same two locales for every shot).
    Use the tool's returned labels and missingLocales exactly as given; do not
    invent labels for locales the tool marked missing. Return one entry per
    shot, in the same order, combining shotId with the tool's labels and
    missingLocales.`,
  output: s.array(
    s.object({
      shotId: s.string,
      labels: s.record(s.string),
      missingLocales: s.array(s.string),
    }),
  ),
});

export default multilingualSubtitleManifestBuilder;
```
