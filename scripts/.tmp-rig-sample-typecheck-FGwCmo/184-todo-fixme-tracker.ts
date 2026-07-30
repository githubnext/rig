import { agent, p, s } from "rig";

// Agent role: scan source files for TODO/FIXME/HACK comments and write a grouped markdown report.
const todoFixmeTracker = agent({
  model: "typecheck",
  instructions: p`Scan source files for comment markers: ${p.bash("grep -rn 'TODO\\|FIXME\\|HACK' --include='*.ts' --include='*.js' --include='*.tsx' --include='*.py' . 2>/dev/null | grep -v node_modules | head -100 || echo ''")}. Parse each matching line to extract file path, line number, comment type (TODO, FIXME, or HACK), and the message text. Count occurrences by type. Write a grouped markdown report using ${p.write("todo-report.md", "# TODO/FIXME/HACK Report\n")}. Return all found items and summary counts.`,
  output: s.object({
    todos: s.array(s.object({
      file: s.path,
      line: s.int,
      type: s.enum("TODO", "FIXME", "HACK"),
      message: s.string,
    })),
    totalCount: s.int,
    byType: s.record(s.int),
    reportWritten: s.boolean,
  }),
});

export default todoFixmeTracker;
