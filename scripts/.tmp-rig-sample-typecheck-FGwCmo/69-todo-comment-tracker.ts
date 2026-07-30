import { agent, p, s } from "rig";

// Agent role: scan source files for TODO/FIXME/HACK comments and produce a structured report.
const todoCommentTracker = agent({
  model: "typecheck",
  instructions: p`Scan source files using ${p.bash("grep -rn 'TODO\\|FIXME\\|HACK' --include='*.ts' . 2>/dev/null || true")} and produce a structured list of all found comments. Write a markdown report to todo-report.md via ${p.write("todo-report.md", "<!-- report -->")}`,
  output: s.object({
    items: s.array(s.object({
      file: s.path,
      line: s.int,
      kind: s.enum("TODO", "FIXME", "HACK"),
      message: s.string,
    })),
    totalCount: s.int,
    markdown: s.string,
  }),
});

export default todoCommentTracker;

