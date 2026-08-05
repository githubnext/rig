# 340 - Flat Workflow Port (rig/globals direct port)

Demonstrates the **minimal migration path** for a flat Claude dynamic workflow
script whose orchestration code lives at the module's top level rather than
inside a `body` function. Use `"rig/globals"` to get `call`, `pipeline`, and
`parallel` as ambient proxies that delegate to the active launcher context —
the same pattern Claude dynamic workflows use for injected globals.

Compare with [310-workflow-audit-verify.md](310-workflow-audit-verify.md), which
shows the fully idiomatic `workflow({ body })` form. Prefer the `body`
destructuring style for new programs; use `"rig/globals"` only when porting an
existing flat script one step at a time.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping.

**Claude dynamic workflow** (original flat script):
```js
export const meta = { name: "triage", description: "Triage open issues",
  phases: ["Fetch", "Triage"] }

phase("Fetch")
const raw = await agent("List the 5 most recent open GitHub issues, one per line.")
const issues = (raw ?? "").split("\n").map((s) => s.trim()).filter(Boolean)

phase("Triage")
const verdicts = await pipeline(issues, (issue) =>
  agent(`Classify priority for: ${issue}`, {
    schema: { type: "object", properties: {
      priority: { type: "string", enum: ["high", "medium", "low"] }
    }, required: ["priority"], additionalProperties: false }
  }))

return verdicts.filter(Boolean).filter((v) => v.priority === "high").length
```

**Rig port — flat style** (step 1: minimal changes, `rig/globals` for ambient context):

```rig
import { call, pipeline } from "rig/globals";
import { phase, workflow, s } from "rig";

// Mirrors the Claude dynamic workflow's injected `call`/`pipeline` globals.
// `rig/globals` proxies delegate to the launcher's active workflow run.

phase("Fetch");
const raw = await call.text("List the 5 most recent open GitHub issues, one per line.");
const issues = (raw ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean);

phase("Triage");
const verdicts = await pipeline(issues, (issue: string) =>
  call.json(`Classify priority for: ${issue}`, s.object({ priority: s.enum("high", "medium", "low") })));

// Workflow role: expose metadata for progress displays and tooling.
export default workflow({
  meta: { name: "triage", description: "Triage open issues", phases: ["Fetch", "Triage"] },
  body: async () => verdicts.filter((v) => v?.priority === "high").length,
});
```

> **Step 2 (idiomatic):** move `phase`, `call`, and `pipeline` inside `body`
> and remove the `"rig/globals"` import — see
> [310-workflow-audit-verify.md](310-workflow-audit-verify.md) for the result.
