# 118 - Pr Review Checklist

```rig
import { agent, p, s, repair } from "rig";

// Agent role: generate a PR review checklist from the recent git diff.
const prReviewChecklist = agent({
  model: "mini",
  maxTurns: 6,
  addons: repair(),
  instructions: p`Generate a PR review checklist based on the changes in this branch.

Changed files:
${p.bash("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only HEAD 2>/dev/null || echo 'no diff available'")}

Diff summary:
${p.bash("git diff --stat HEAD~1 2>/dev/null || git diff --stat HEAD 2>/dev/null || echo 'no diff stats'")}

Key changes:
${p.bash("git diff HEAD~1 -- . 2>/dev/null | head -200 || echo 'no diff content'")}

For each concern in the changes, produce a checklist item with:
- A clear action item description
- Category (test/docs/security/performance/style)
- Priority (high/medium/low)

Also list the changed files and indicate if the PR is ready for review.
Return only the declared output.`,
  output: s.object({
    checklist: s.array(
      s.object({
        item: s.string,
        category: s.enum("test", "docs", "security", "performance", "style"),
        priority: s.enum("high", "medium", "low"),
      })
    ),
    changedFiles: s.array(s.string),
    ready: s.boolean,
  }),
});

export default prReviewChecklist;
```
