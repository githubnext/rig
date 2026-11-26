# 583 - Accessibility Coverage Arbitrator

```rig
import { agent, p, s } from "rig";

const finding = s.object({
  criterion: s.string, status: s.enum("pass", "fail", "partial", "not_observed"),
  observation: s.nullable(s.string), evidence: s.nullable(s.string),
});
const review = s.object({
  reviewer: s.enum("keyboard", "semantics"), findings: s.array(finding),
  missingCriteria: s.array(s.string), summary: s.string,
});

// Agent role: independently audit keyboard accessibility evidence without inferring absent observations.
const keyboardAccessibilityReviewer = agent({
  name: "keyboardAccessibilityReviewer", model: "small",
  input: s.object({ notes: s.string }), output: review,
  instructions: "Audit only input.notes for keyboard criteria. Return pass, fail, partial, or not_observed findings; use null observation/evidence when silent, preserve exact evidence, list missingCriteria, and set reviewer to keyboard.",
});

// Agent role: independently audit semantic and assistive-technology evidence without inferring keyboard behavior.
const semanticAccessibilityReviewer = agent({
  name: "semanticAccessibilityReviewer", model: "mini",
  input: s.object({ notes: s.string }), output: review,
  instructions: "Audit only input.notes for semantic and assistive-technology criteria. Never infer missing behavior; use nullable observation/evidence for gaps, preserve exact evidence, list missingCriteria, and set reviewer to semantics.",
});

// Agent role: coordinate independent accessibility evidence and reconcile bounded coverage.
const accessibilityCoverageArbitrator = agent({
  name: "accessibilityCoverageArbitrator", model: "large",
  agents: { keyboardAccessibilityReviewer, semanticAccessibilityReviewer },
  instructions: p`Coordinate an audit over six criteria: focus-order, focus-visible, labels, error-association, dialog-escape, and status-announcement.
Keyboard note:
${p.bash("printf '%s\\n' 'Checkout keyboard audit: Tab reaches email and payment fields, but the coupon dialog traps focus and its close button has no visible focus ring.' 'Keyboard reviewer did not test screen-reader announcements or form error semantics.'")}
Semantic note:
${p.bash("printf '%s\\n' 'Checkout semantic audit: email and card fields have labels; the payment error is not programmatically associated.' 'Semantic reviewer did not observe tab order, focus styling, dialog Escape behavior, or status announcements.'")}
Call both named reviewers independently with their corresponding exact note text; do not pass reports between them. Preserve both complete typed reports unchanged. Record every disagreement with nullable observations and a resolution. Normalize to the six criteria, compute coveragePct as 100 times criteria with any non-null observation divided by six, keep it bounded, and add missing finding records for criteria with no usable observation.`,
  output: s.object({
    keyboardReport: review, semanticReport: review,
    disagreements: s.array(s.object({ criterion: s.string, keyboardObservation: s.nullable(s.string), semanticObservation: s.nullable(s.string), resolution: s.string })),
    coverageSummary: s.object({
      coveragePct: s.percent, observedCriteria: s.array(s.string),
      missingFindings: s.array(s.object({ criterion: s.string, reason: s.string, observedBy: s.nullable(s.string) })),
    }),
  }),
});

export default accessibilityCoverageArbitrator;
```
