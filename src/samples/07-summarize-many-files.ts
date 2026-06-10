import { agent, p, s } from "rig";

// Agent role: summarize the repository file list in one sentence.

const summarizeFiles = agent({
  model: "mini",
  instructions: "Summarize the repository file list in one sentence.",
  input: s.object({
    files: s.string,
  }),
  output: s.object({
    summary: s.string,
  }),
});

await summarizeFiles({
  files: p.bash("find src -name '*.ts' -type f | sort"),
});

export default summarizeFiles;
