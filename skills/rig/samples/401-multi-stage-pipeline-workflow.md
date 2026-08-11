# 401 - Multi-Stage Pipeline (pipeline enrichment chain)

Demonstrates `pipeline` with **multiple stages** — the rig equivalent of a
chained `pipeline(items, fn1, fn2, ...)` in a Claude dynamic workflow.

Each stage receives `(previous, item, index)` where `previous` is the output of
the prior stage (or the item itself for stage 1). This is the key difference
from Claude's `(item, index)` signature: rig threads the prior result forward so
stages can enrich rather than restart from the original item.

```
Claude dynamic workflow           →    rig
pipeline(issues, triage, fix)          pipeline(issues, triage, fix)
triage: (issue, idx) => ...            triage: (prev, issue, idx) => ...   // prev === issue for stage 1
fix:    (issue, idx) => ...            fix:    (triage, issue, idx) => ...  // triage result threaded in
```

If a stage returns `null` (agent failure), subsequent stages for that item are
skipped and `null` propagates to the output.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping and
[310-workflow-audit-verify.md](310-workflow-audit-verify.md) for a single-stage
parallel-then-pipeline pattern.

```rig
import { s, workflow } from "rig";

// Workflow role: triage fictional issues then propose a fix for each — two chained pipeline stages.
export default workflow({
  meta: {
    name: "issueTriageAndFix",
    description: "Triage issues then propose a fix for each via a two-stage pipeline",
    phases: ["Load", "Triage+Fix"],
  },
  body: async ({ call, phase, pipeline }) => {
    phase("Load");
    const raw = await call.text("List 3 short fictional bug descriptions, one per line.");
    const issues = (raw ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean);

    phase("Triage+Fix");
    // Two-stage pipeline: stage 1 classifies, stage 2 proposes a fix.
    // Stage 1: prev === issue (first stage receives the item as prev).
    // Stage 2: prev === stage-1 output — triage result is threaded in.
    return pipeline(
      issues,
      (_prev: string, issue: string) =>
        call.json(
          `Triage this bug: "${issue}". Classify priority.`,
          s.object({ priority: s.enum("high", "medium", "low"), rationale: s.string }),
          { label: `triage:${issue.slice(0, 24)}` },
        ),
      (prev: { priority: string; rationale: string } | null, issue: string) =>
        prev
          ? call.json(
              `Issue: "${issue}" — ${prev.priority} priority (${prev.rationale}). Suggest a one-line fix.`,
              s.object({ fix: s.string, effort: s.enum("small", "medium", "large") }),
              { phase: "Triage+Fix", label: `fix:${issue.slice(0, 24)}` },
            )
          : null,
    );
  },
});
```
