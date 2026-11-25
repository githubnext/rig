# 575 - Education Sparse Catalog Patch

```rig
import { agent, p, s, workflow } from "rig";

const changes = s.object({
  title: s.optional(s.nullable(s.string)),
  description: s.optional(s.nullable(s.string)),
});
const patchSchema = s.object({ id: s.string, course: s.string, unit: s.string, changes });
const auditSchema = s.object({
  id: s.string, status: s.enum("applied", "rejected"),
  effects: s.record(s.string), reason: s.string,
});
type Patch = { id: string; course: string; unit: string; changes: { title?: string | null; description?: string | null } };
type Audit = { id: string; status: "applied" | "rejected"; effects: Record<string, string>; reason: string };

// Agent role: explain the deterministic patch audit without changing its results.
const explainAudit = agent({
  model: "small",
  input: s.object({ patches: s.array(patchSchema), audit: s.array(auditSchema) }),
  output: s.object({ explanation: s.string }),
  instructions: p`Using ${p.bash("printf 'Sparse catalog patch audit'")}, briefly explain the supplied audit. Distinguish omission, null, replacement, and rejected paths; do not alter the audit.`,
});

// Workflow role: apply ordered patches to existing catalog paths and audit each decision.
const catalogPatch = workflow({
  meta: { name: "education-sparse-catalog-patch", description: "Apply and audit sparse nested catalog updates" },
  body: async ({ call }) => {
    const catalog: Record<string, { units: Record<string, { title: string | null; description: string | null }> }> = {
      math: { units: { algebra: { title: "Algebra", description: "Equations" }, geometry: { title: "Geometry", description: "Shapes" } } },
      science: { units: { biology: { title: "Biology", description: "Living things" } } },
    };
    const patches: Patch[] = [
      { id: "clear", course: "math", unit: "algebra", changes: { description: null } },
      { id: "omit", course: "math", unit: "geometry", changes: {} },
      { id: "replace", course: "math", unit: "algebra", changes: { title: "Algebra I" } },
      { id: "unknown", course: "math", unit: "calculus", changes: { title: "Calculus" } },
    ];
    const audit: Audit[] = [];
    for (const patch of patches) {
      if (!Object.hasOwn(catalog, patch.course) || !Object.hasOwn(catalog[patch.course].units, patch.unit)) {
        audit.push({ id: patch.id, status: "rejected", effects: {}, reason: "Unknown course or unit path" });
        continue;
      }
      const unit = catalog[patch.course].units[patch.unit];
      const effects: Record<string, string> = {};
      for (const field of ["title", "description"] as const) {
        const value = patch.changes[field];
        effects[field] = value === undefined ? "keep" : value === null ? "clear" : "replace";
        if (value !== undefined) unit[field] = value;
      }
      audit.push({ id: patch.id, status: "applied", effects, reason: "Existing path" });
    }
    const explanation = await call(explainAudit, { patches, audit });
    return { catalog, audit, explanation: explanation?.explanation ?? "Explanation unavailable; the deterministic audit is authoritative." };
  },
});

export default catalogPatch;
```
