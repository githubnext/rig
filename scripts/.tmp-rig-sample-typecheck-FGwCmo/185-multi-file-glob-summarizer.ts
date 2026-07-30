import { agent, p, s } from "rig";

// Agent role: summarize a single TypeScript source file in one sentence.
const fileSummarizer = agent({
  name: "fileSummarizer",
  model: "typecheck",
  input: s.object({ filePath: s.path }),
  instructions: p`Read and summarize the file: ${p.readInput("filePath")}. Return a one-sentence summary of what the file does.`,
  output: s.string,
});

// Agent role: find TypeScript source files and delegate summarization to fileSummarizer, then aggregate results keyed by path.
const multiFileGlobSummarizer = agent({
  model: "typecheck",
  instructions: p`Find TypeScript source files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -15 || echo ''")}. For each file path found, delegate to the fileSummarizer subagent passing the file path. Collect all summaries into a record keyed by file path. If no files are found, return an empty record.`,
  output: s.record(s.string),
  agents: { fileSummarizer },
});

export default multiFileGlobSummarizer;
