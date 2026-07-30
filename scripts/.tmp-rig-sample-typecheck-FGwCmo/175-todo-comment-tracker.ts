import { agent, p, s } from "rig";

// Agent role: scan source files for TODO/FIXME/HACK comments and write a markdown report.
const todoCommentTracker = agent({
  model: "typecheck",
  instructions: p`Scan source files: ${p.bash("grep -rn 'TODO\\|FIXME\\|HACK' --include='*.ts' --include='*.js' --include='*.tsx' . 2>/dev/null || true")}. Parse each matching line to extract file path, line number, comment type (TODO/FIXME/HACK), and comment text. Write a grouped markdown report via ${p.write("todo-report.md", "# TODO Report\n")}. Return all found comments and the total count.`,
  output: s.object({
    comments: s.array(s.object({
      file: s.path,
      line: s.int,
      type: s.enum("TODO", "FIXME", "HACK"),
      text: s.string,
    })),
    totalCount: s.int,
    reportWritten: s.boolean,
  }),
});

export default todoCommentTracker;
