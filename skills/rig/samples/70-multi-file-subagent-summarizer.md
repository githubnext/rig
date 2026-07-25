# 70 - Multi File Subagent Summarizer

```rig
import { agent, p, s } from "rig";

// Agent role: summarize a single TypeScript file.
const fileSummarizer = agent({
  name: "fileSummarizer",
  model: "nano",
  input: s.object({ filePath: s.path }),
  instructions: p`Summarize the TypeScript file at ${p.readInput("filePath")} in one concise sentence.`,
  output: s.object({ summary: s.string }),
});

// Agent role: find TypeScript source files and delegate to fileSummarizer to summarize each one, then aggregate results.
const multiFileSummarizer = agent({
  model: "small",
  instructions: p`Find TypeScript files using ${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -10 || echo 'no files'")} then delegate each file path to the fileSummarizer subagent and collect summaries keyed by file path.`,
  output: s.record(s.string),
  agents: { fileSummarizer },
});

export default multiFileSummarizer;

```
