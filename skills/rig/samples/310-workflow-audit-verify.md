# 310 - Audit and Verify (Dynamic Workflow Port)

Mirrors a Claude Code dynamic workflow: fan out finders, then stream each finding
through a verifier stage. See
[claude-workflow-conversion.md](../references/claude-workflow-conversion.md).

```rig
import { s, workflow } from "rig";

const finding = s.object({ title: s.string, file: s.path });

// Workflow role: audit source areas in parallel, then verify each finding.
const audit = workflow({
  meta: {
    name: "audit",
    description: "Find and verify repository issues",
    phases: [{ title: "Find" }, { title: "Verify", detail: "one verifier per finding" }],
    whenToUse: "Auditing several areas that each need independent verification.",
  },
  body: async ({ call, parallel, phase, pipeline }) => {
    phase("Find");
    const areas = ["skills", "src", "scripts"];
    const found = await parallel(areas.map((area) => () =>
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
