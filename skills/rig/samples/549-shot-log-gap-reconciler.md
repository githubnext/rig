# 549 - Shot Log Gap Reconciler

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: look up recorded take metadata from an embedded takes log.
const findTakeMetadata = defineTool("find_take_metadata", {
  description: "Look up duration metadata for a scene/take from the takes log.",
  parameters: s.object({
    sceneId: s.string,
    takeNumber: s.int,
  }),
  handler: async ({ sceneId, takeNumber }: { sceneId: string; takeNumber: number }) => {
    const takesLog: Record<string, Record<number, number>> = {
      "SC-101": { 1: 42.5, 2: 38.1 },
      "SC-204": { 1: 55.0, 3: 50.2 },
      "SC-317": { 2: 61.3 },
    };
    const duration = takesLog[sceneId]?.[takeNumber];
    if (duration === undefined) return { found: false };
    return { found: true, durationSec: duration };
  },
});

// Agent role: reconcile an expected shot list against logged takes and report completeness.
const shotLogGapReconciler = agent({
  model: "small",
  instructions: p`A production shot list defines these expected takes:
    - Scene SC-101: expected takes 1, 2, 3
    - Scene SC-204: expected takes 1, 2, 3
    - Scene SC-317: expected takes 1, 2

    For each expected (sceneId, takeNumber) pair, call find_take_metadata once.
    If the tool returns found=true, mark status "logged"; if found=false, mark
    status "missing". Return an array of all expected pairs with their status,
    plus a summary object with completenessPct computed as
    (count of "logged" / total expected takes) * 100.`,
  tools: [findTakeMetadata],
  output: s.object({
    takes: s.array(
      s.object({
        sceneId: s.string,
        takeNumber: s.int,
        status: s.enum("logged", "missing"),
      }),
    ),
    summary: s.object({
      completenessPct: s.number,
    }),
  }),
});

export default shotLogGapReconciler;
```
