# 194 - Todo Fixme Tracker

```rig
import { agent, defineTool, p, s } from "rig";

const classifyComment = defineTool("classifyComment", {
  description: "Classify a source code comment line by marker type and whether it has an owner",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const match = line.match(/\b(TODO|FIXME|HACK|XXX)\b/);
    const type = (match?.[1] ?? "TODO") as "TODO" | "FIXME" | "HACK" | "XXX";
    const hasOwner = /\([\w.@-]+\)/.test(line);
    return { type, hasOwner };
  },
});

// Agent role: scan source files for TODO/FIXME/HACK/XXX comments and produce a structured report.
const todoFixmeTracker = agent({
  model: "small",
  instructions: p`You are a TODO/FIXME/HACK/XXX comment tracker.

Scan TypeScript and JavaScript source files for comment markers:
${p.bash("grep -rn 'TODO\\|FIXME\\|HACK\\|XXX' --include='*.ts' --include='*.js' . 2>/dev/null | grep -v node_modules || true")}

For each matching line, use the classifyComment tool to determine the type and whether it names an owner.
Collect all items and compute totalCount and byType counts.
Write a markdown summary in the "report" field.
${p.writeOutput("report", "TODO_REPORT.md")}`,
  tools: [classifyComment],
  output: s.object({
    report: s.string,
    items: s.array(s.object({
      file: s.path,
      line: s.int,
      type: s.enum("TODO", "FIXME", "HACK", "XXX"),
      text: s.string,
    })),
    totalCount: s.int,
    byType: s.record(s.int),
  }),
});

export default todoFixmeTracker;
```
