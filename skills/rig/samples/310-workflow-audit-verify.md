# 310 - Audit and Verify (Dynamic Workflow Port)

Mirrors a Claude Code dynamic workflow: fan out finders, then stream each finding
through a verifier stage. Demonstrates the `args`→`input` translation — the most
common first step when porting a Claude dynamic workflow to rig.

**Claude dynamic workflow** (original):
```js
export const meta = { name: "audit", description: "Find and verify issues",
  phases: [{ title: "Find" }, { title: "Verify" }] }
// `args` is parsed JSON supplied by the caller
phase("Find")
const found = await parallel(args.areas.map((area) => () =>
  agent(`Audit ${area}. Report findings.`, { schema: FINDINGS, label: area })))
phase("Verify")
const verdicts = await pipeline(
  found.filter(Boolean).flatMap((r) => r.findings),
  (f) => agent(`Verify: ${f.title} in ${f.file}.`, { schema: VERDICT, phase: "Verify" }))
return verdicts.filter(Boolean).filter((v) => v.real).length
```

**Rig port** (below): `args` becomes `input` with an `s.object` schema;
`agent(prompt, { schema })` becomes `call.json(prompt, schema)`; everything else
maps 1-to-1. See
[claude-workflow-conversion.md](../references/claude-workflow-conversion.md) for
the full primitive mapping.

```rig
import { s, workflow } from "rig";

const finding = s.object({ title: s.string, file: s.path });

// Workflow role: audit caller-supplied source areas in parallel, then verify each finding.
// `input.areas` is the rig equivalent of `args.areas` in a Claude dynamic workflow.
const audit = workflow({
  meta: {
    name: "audit",
    description: "Find and verify repository issues",
    phases: [{ title: "Find" }, { title: "Verify", detail: "one verifier per finding" }],
    whenToUse: "Auditing several areas that each need independent verification.",
  },
  input: s.object({ areas: s.array(s.string("Source directories to audit")) }),
  body: async ({ call, input, parallel, phase, pipeline }) => {
    phase("Find");
    const found = await parallel(input.areas.map((area) => () =>
      call.json(`Audit ${area}/ for risky patterns.`, s.object({ findings: s.array(finding) }), { label: area })));

    phase("Verify");
    const verdicts = await pipeline(
      found.flatMap((result) => result?.findings ?? []),
      (item: { title: string; file: string }) =>
        call.json(`Verify "${item.title}" in ${item.file}.`, s.object({ real: s.boolean }), { phase: "Verify" }),
    );
    return verdicts.filter((verdict) => verdict?.real).length;
  },
});

export default audit;
```
