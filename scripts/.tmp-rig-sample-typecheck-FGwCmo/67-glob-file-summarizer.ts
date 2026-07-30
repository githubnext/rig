import { agent, p, s } from "rig";
// Agent role: summarize TypeScript source files found by glob and return a record keyed by path.
const fileSummarizer = agent({
  model: "typecheck",
  input: s.object({ path: s.string, content: s.string }),
  output: s.object({ path: s.string, summary: s.string }),
  instructions: "Summarize the file content in one sentence.",
});

// Agent role: find all TypeScript files with p.glob, then use fileSummarizer to summarize each.
const globSummarizer = agent({
  model: "typecheck",
  output: s.record(s.string, "summaries keyed by file path"),
  agents: { fileSummarizer },
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. For each file use fileSummarizer to produce a one-sentence summary, then return a record mapping each path to its summary.`,
});
export default globSummarizer;
