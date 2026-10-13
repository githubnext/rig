# 556 - Tabular Measurement Source Priority Reconciler

```rig
import { agent, p, s } from "rig";

// Agent role: reconcile conflicting shelf and digital copy-count sources per title
// using an asymmetric source-priority override rule, classifying each resolution path.
const tabularMeasurementSourcePriorityReconciler = agent({
  model: "small",
  instructions: p`Shelf inventory (physical copy counts), from ${p.bash("cat <<'DATA'\ntitle,shelfCopies\nThe Silent Archive,4\nBeneath Northern Skies,0\nLetters to a Vanished City,2\nThe Cartographer's Ledger,6\nWhispers in the Stacks,3\nA History of Quiet Rooms,0\nDATA")}

Digital lending system export (digital copy counts, which normally supersede
shelf counts), from ${p.bash("cat <<'DATA'\ntitle,digitalCopies\nThe Silent Archive,4\nBeneath Northern Skies,5\nLetters to a Vanished City,0\nThe Cartographer's Ledger,6\nThe Forgotten Marginalia,2\nDATA")}

Reconcile the two sources into one row per distinct title using this rule:
- If a title appears only in the shelf list, status is "shelf-only" and
  reconciledCopies is the shelf count.
- If a title appears only in the digital list, status is "digital-only" and
  reconciledCopies is the digital count.
- If a title appears in both and the digital count is nonzero, the digital
  count is used as reconciledCopies. If the digital count equals the shelf
  count, status is "agreed"; if it differs from the shelf count, status is
  "overridden" (digital's literal reported count is what is used, overriding
  a different shelf value).
- If a title appears in both and the digital count is 0 while the shelf count
  is nonzero, the digital system's zero likely just means "not tracked
  digitally": use the shelf count as reconciledCopies instead, and set status
  to "overridden" (the digital system's literal reported count of 0 was NOT
  the one used).
- If both report 0, treat that as "agreed" with reconciledCopies 0.
Return one row per title covering all titles seen across both sources, with
no duplicates. Return only the declared output.`,
  output: s.array(s.object({
    title: s.string,
    reconciledCopies: s.number,
    status: s.enum("shelf-only", "digital-only", "agreed", "overridden"),
  })),
});

export default tabularMeasurementSourcePriorityReconciler;
```
