# 554 - Conflicting Source Timeline Reconciler

```rig
import { agent, p, s } from "rig";

// Agent role: reconcile three disagreeing recipe-timing sources into one
// resolved cook time per step using a deterministic median/tie-break rule.
const conflictingSourceTimelineReconciler = agent({
  model: "mini",
  instructions: p`Three sources describe cook times (in minutes) for the same
    recipe steps, and they disagree:

    Cookbook (source: "cookbook"):
    ${p.bash(`cat <<'EOF'
Step 1 - Saute onions = 8
Step 2 - Simmer sauce = 25
Step 3 - Cook pasta = 11
Step 4 - Rest before serving = 5
EOF`)}

    Video transcript (source: "video"):
    ${p.bash(`cat <<'EOF'
Step 1 - Saute onions = 10
Step 2 - Simmer sauce = 20
Step 3 - Cook pasta = 9
Step 4 - Rest before serving = 5
EOF`)}

    User review (source: "review"):
    ${p.bash(`cat <<'EOF'
Step 1 - Saute onions = 12
Step 2 - Simmer sauce = 30
Step 3 - Cook pasta = 9
Step 4 - Rest before serving = 7
EOF`)}

    For each step, you have exactly three numeric values: cookbook, video,
    review. Resolve one value per step using this deterministic rule:
    1. Sort the three values. The resolved value is the median (middle)
       value.
    2. Exception: if the distance from the lowest value to the middle value
       equals the distance from the middle value to the highest value (the
       three values are evenly spaced, e.g. 9, 9, 9 is not this case but
       8, 10, 12 is), the median is ambiguous — in that case ignore the
       median and instead use the cookbook's own value for that step.
    3. If all three source values are exactly equal, use that common value
       and there is no conflict.

    Set conflict to true whenever the three source values are not all
    identical (regardless of which resolution rule applied). sourceMinutes
    must be a record with keys "cookbook", "video", "review" mapping to each
    source's original value for that step. Return one entry per step, in
    step order, with a short step label as "step".`,
  output: s.array(s.object({
    step: s.string,
    resolvedMinutes: s.number,
    sourceMinutes: s.record(s.number),
    conflict: s.boolean,
  })),
});

export default conflictingSourceTimelineReconciler;
```
