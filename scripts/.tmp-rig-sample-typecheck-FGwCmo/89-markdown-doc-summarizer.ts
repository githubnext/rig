import { agent, p, s } from "rig";

// Agent role: summarize each top-level section of a markdown doc, then compile into a full report.
const sectionSummarizer = agent({
  name: "sectionSummarizer",
  model: "typecheck",
  instructions: p`Summarize the section of documentation provided in the input.`,
  input: s.object({ heading: s.string, content: s.string }),
  output: s.object({ heading: s.string, summary: s.string }),
});

// Agent role: read the project README, delegate per-section summarization, and write the final report.
const markdownDocSummarizer = agent({
  model: "typecheck",
  instructions: p`Read the README: ${p.readOptional("README.md", "No README found.")}. Identify each top-level heading (##) and its content. Delegate summarization of each section to the sectionSummarizer agent. Compile all summaries into a report and write it to summaries/README-summary.md via ${p.writeOutput("reportPath", "summaries/README-summary.md")}.`,
  output: s.object({
    sections: s.array(s.object({ heading: s.string, summary: s.string })),
    reportPath: s.string,
  }),
  agents: { sectionSummarizer },
});

export default markdownDocSummarizer;
