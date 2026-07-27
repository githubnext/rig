# 225 - Pr Review Checklist V2

```rig
import { agent, p, s, repair } from "rig";

// Agent role: generate a PR review checklist from the current git diff.
const prReviewChecklist = agent({
  model: "small",
  maxTurns: 6,
  addons: repair(),
  instructions: p`Generate a PR review checklist based on these changes.

Changed files:
${p.bash("git diff --stat HEAD~1 2>/dev/null || git diff --stat HEAD 2>/dev/null || echo 'no diff available'")}

Diff:
${p.bash("git diff HEAD~1 -- . 2>/dev/null | head -300 || git diff HEAD -- . 2>/dev/null | head -300 || echo 'no diff'")}

For each concern, produce a checklist item with a clear description, category (security/performance/correctness/style/testing), and priority (must/should/nice-to-have). List changed files and indicate if the PR is ready for review.`,
  output: s.object({
    checklist: s.array(s.object({
      item: s.string,
      category: s.enum("security", "performance", "correctness", "style", "testing"),
      priority: s.enum("must", "should", "nice-to-have"),
    })),
    changedFiles: s.array(s.path),
    ready: s.boolean,
  }),
});

export default prReviewChecklist;
```
