import { agent, p, s, workflow } from "rig";
// Agent role: summarize a single TypeScript file.
const fileSummarizer = agent({
  name: "fileSummarizer",
  model: "typecheck",
  input: s.object({ filePath: s.path }),
  instructions: p`Summarize the TypeScript file at ${p.readInput("filePath")} in one concise sentence.`,
  output: s.object({ summary: s.string }),
});
// Workflow role: deterministically discover files, run subagent summaries in parallel, and aggregate by file path.
const multiFileSummarizer = workflow({
  meta: { name: "multiFileSummarizer", description: "Summarize TypeScript files", phases: ["Discover", "Summarize"] },
  body: async ({ call, phase, pipeline }) => {
    phase("Discover");
    const raw = await call.text(
      `List up to 10 TypeScript files from src (one path per line) using ${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -10 || true")}.`,
    );
    const files = (raw ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    phase("Summarize");
    const rows = await pipeline(files, async (filePath) => {
      const out = await call(fileSummarizer, { filePath }, { label: filePath });
      return out ? [filePath, out.summary] as const : null;
    });
    return Object.fromEntries(rows.filter((row): row is readonly [string, string] => !!row));
  },
});

export default multiFileSummarizer;

