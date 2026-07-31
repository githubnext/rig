# 330 - Nested Workflow Composition (call.workflow)

Demonstrates `call.workflow` — the rig equivalent of `workflow(ref, args)` in
Claude dynamic workflows. A parent workflow delegates a self-contained child
workflow inline. The child shares the parent's concurrency limiter, agent
budget, cancellation signal, and event stream.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping and
[dynamic-workflows.md](../references/dynamic-workflows.md) for `call.workflow`
semantics.

```rig
import { s, workflow } from "rig";

// Workflow role: scan one directory for issues and return structured findings.
const scanDir = workflow({
  meta: {
    name: "scanDir",
    description: "Scan a directory for issues",
    phases: ["Scan"],
  },
  input: s.object({ dir: s.path }),
  body: async ({ call, input, phase }) => {
    phase("Scan");
    return call.json(
      `List up to 5 issues found in ${input.dir}. Be specific.`,
      s.object({ issues: s.array(s.string) }),
      { label: input.dir },
    );
  },
});

// Workflow role: run scanDir on each root area, then produce a combined report.
// Mirrors Claude dynamic-workflow pattern: `await workflow(ref, args)` becomes
// `await call.workflow(child, args)` — the child runs inline on the same budget.
// Use `parallel(thunks)` so failures become null holes and WorkflowLimitError propagates.
const fullAudit = workflow({
  meta: {
    name: "fullAudit",
    description: "Audit several directories and produce a combined report",
    phases: ["Audit", "Report"],
  },
  body: async ({ call, parallel, phase }) => {
    phase("Audit");
    const dirs = ["src", "skills", "scripts"];
    const results = await parallel(
      dirs.map((dir) => () => call.workflow(scanDir, { dir }, { label: dir })),
    );

    phase("Report");
    const allIssues = results.flatMap((r, i) =>
      (r?.issues ?? []).map((issue) => `[${dirs[i]}] ${issue}`),
    );
    return call.json(
      `Summarise these issues into a short executive report:\n${allIssues.join("\n")}`,
      s.object({ summary: s.string, severity: s.enum("low", "medium", "high") }),
    );
  },
});

export default fullAudit;
```
