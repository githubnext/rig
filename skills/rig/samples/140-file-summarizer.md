# 140 - File Summarizer

```rig
import { agent, configureAgent, copilotEngine, p, s } from "rig";

configureAgent(copilotEngine());

const FileSummary = s.object({ path: s.path, summary: s.string });

// Agent role: read one file and return a 1-2 sentence summary.
const summarizeFile = agent({
  name: "file-summarizer",
  model: "mini",
  input: { path: s.path },
  instructions: p`Summarize the following file in 1-2 sentences:\n${p.readInput("path")}`,
  output: FileSummary,
});

// Agent role: discover TypeScript source files, summarize each with the summarizeFile subagent, then write a global project summary.
const projectSummarizer = agent({
  name: "project-summarizer",
  model: "small",
  agents: { summarizeFile },
  instructions: p`
List TypeScript source files (excluding node_modules and .git):
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | sort | head -20")}
Call summarizeFile for each file path, then write a concise globalSummary of the whole project.
`,
  output: s.object({
    files: s.array(FileSummary),
    globalSummary: s.string,
  }),
});

export default projectSummarizer;
```
