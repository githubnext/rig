# 235 - Pr Review Checklist V3

```rig
import { agent, p, s, repair } from "rig";

// Agent role: generate a structured PR review checklist from the current git diff.
const prReviewChecklist = agent({
  model: "small",
  instructions: p`Generate a structured PR review checklist based on the git diff below.

Changed files summary:
${p.bash("git diff HEAD~1 --stat 2>/dev/null || git diff --stat 2>/dev/null || echo 'No diff available'")}

Diff content (first 200 lines):
${p.bash("git diff HEAD~1 -- . 2>/dev/null | head -200 || git diff -- . | head -200 || echo 'No diff available'")}

Analyze the diff and produce:
1. A checklist of specific review items, each categorized and prioritized.
2. The list of changed file paths.
3. Whether the PR appears ready to merge (ready: true if no high-priority issues).`,
  output: s.object({
    checklist: s.array(s.object({
      item: s.string,
      category: s.enum("security", "performance", "correctness", "style", "docs", "tests"),
      priority: s.enum("high", "medium", "low"),
    })),
    changedFiles: s.array(s.path),
    ready: s.boolean,
  }),
  addons: [repair()],
});

export default prReviewChecklist;
```
