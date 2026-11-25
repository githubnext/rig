# 573 - Media Readall Budget

```rig
import { agent, p, s } from "rig";

// Agent role: assemble fixed shot and subtitle artifacts, measure coverage, and budget a bounded shoot.
const mediaReadAllBudget = agent({
  model: "large",
  instructions: p`Read both fixed local artifacts together before reasoning:
${p.readAll(["fixtures/media/shot-log.csv", "fixtures/media/subtitles.srt"])}
The shot-log table contains shotId, sceneId, and durationSec rows; the subtitle artifact
contains shotId-keyed, time-coded cues. Merge cues by shotId and compute subtitleCoverageSec
and coveragePct (merged covered cue seconds / durationSec * 100, clipped to 0..100).
Return one measurement row per matched shot. Preserve sourcePaths.shotLog and
sourcePaths.subtitles as the exact fixed paths. Allocate a shoot-day plan capped at
5 days and 8 planned hours per day, prioritizing low-coverage shots. Keep
allocatedShootDays <= maxShootDays, include every planned shot ID once, and explain
unmatched or malformed records without inventing measurements.`,
  output: s.object({
    sourcePaths: s.record(s.path),
    measurements: s.object({
      rows: s.array(s.object({
        shotId: s.string,
        sceneId: s.string,
        durationSec: s.number,
        subtitleCoverageSec: s.number,
        coveragePct: s.number,
      })),
      totalDurationSec: s.number,
      averageCoveragePct: s.number,
    }),
    budget: s.object({
      maxShootDays: s.int,
      allocatedShootDays: s.int,
      dayPlan: s.array(s.object({
        day: s.int,
        shotIds: s.array(s.string),
        plannedHours: s.number,
      })),
    }),
    notes: s.array(s.string),
  }),
});

export default mediaReadAllBudget;
```
