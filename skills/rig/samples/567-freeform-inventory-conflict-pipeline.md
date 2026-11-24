# 567 - Freeform Inventory Conflict Pipeline

```rig
import { p, s, workflow } from "rig";

const reconciliationSchema = s.object({
  reconciliations: s.array(s.object({
    itemId: s.string,
    location: s.string,
    observations: s.array(s.object({
      quantity: s.int,
      source: s.string,
      provenance: s.string,
    })),
    winner: s.object({
      quantity: s.int,
      source: s.string,
      provenance: s.string,
    }),
    conflict: s.boolean,
  })),
  rawExtractionWarnings: s.array(s.string),
});

// Workflow role: extract raw candidate facts from conflicting free-form reports, then reconcile them deterministically.
const inventoryConflictPipeline = workflow({
  meta: {
    name: "freeform-inventory-conflict-pipeline",
    description: "Extract and reconcile conflicting warehouse inventory reports",
    phases: ["Extract", "Reconcile"],
  },
  body: async ({ call, phase }) => {
    phase("Extract");
    const raw = await call.text(
      p`Extract candidate inventory facts from these two free-form reports.
Output plain text only: one FACT line per observation as compact JSON with itemId, location, quantity, source, and provenance; output every uncertainty as a WARNING line verbatim. Normalize report A source to cycle-count and report B source to scanner. Do not add markdown.

Report A:
${p.bash("printf '%s\\n' 'Cycle-count notebook / Warehouse W1 / 2026-11-23' 'A-100 at aisle A1: 42 units counted.' 'B-200 at bay B4: seven cartons; tally mark is smudged.' 'C-300 at aisle C2: 12 units.')")}

Report B:
${p.bash("printf '%s\\n' 'Handheld scanner narrative / Warehouse W1 / 2026-11-23' 'A-100 at aisle A1: 39 units after damaged stock was removed.' 'B-200 at bay B4: eight cartons; one carton was behind a divider.' 'D-400 at aisle C2: five units; label partly torn.')")}`,
      { model: "mini", label: "extract-freeform-reports" },
    );

    phase("Reconcile");
    const parsed = await call.json(
      p`Reconcile the raw extraction below. Parse only FACT lines and preserve every observation's quantity, source, and provenance. Group by exact itemId plus location. Set conflict true when quantities differ. Choose one deterministic winner per group using source priority cycle-count over scanner over manual; break same-source ties by first FACT line. Preserve every WARNING line exactly, including its WARNING prefix, in rawExtractionWarnings. Do not invent facts or warnings.

Raw extraction:
${raw ?? "WARNING extraction stage returned no text"}`,
      reconciliationSchema,
      { model: "small", label: "reconcile-inventory-conflicts" },
    );
    return parsed ?? { reconciliations: [], rawExtractionWarnings: ["WARNING reconciliation stage failed"] };
  },
});

export default inventoryConflictPipeline;
```
