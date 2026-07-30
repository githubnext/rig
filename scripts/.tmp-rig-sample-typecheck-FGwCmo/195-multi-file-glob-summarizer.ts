import { agent, p, s } from "rig";

// Agent role: summarize a single TypeScript file's purpose and exports.
const fileSummarizer = agent({
  model: "typecheck",
  name: "fileSummarizer",
  input: s.object({ path: s.path }),
  instructions: p`Summarize the following TypeScript file.

File contents:
${p.readInput("path")}

Return a one-sentence summary, the number of lines, and whether the file has any exports.`,
  output: s.object({
    summary: s.string,
    lineCount: s.int,
    hasExports: s.boolean,
  }),
});

// Agent role: discover TypeScript files in the workspace and summarize each via a subagent.
const multiFileGlobSummarizer = agent({
  model: "typecheck",
  instructions: p`You are a multi-file TypeScript summarizer.

Discovered TypeScript files (excluding node_modules):
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*'")}

For each file path, delegate to the fileSummarizer subagent, passing the file path as input.
Aggregate all results into a record keyed by file path.`,
  agents: { fileSummarizer },
  output: s.record(s.object({
    summary: s.string,
    lineCount: s.int,
    hasExports: s.boolean,
  })),
});

export default multiFileGlobSummarizer;
