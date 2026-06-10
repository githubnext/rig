import { agent, s } from "rig";

// Agent role: classify the issue.

const classifyIssue = agent({
  model: "mini",
  instructions: "Classify the issue.",
  input: s.object({
    title: s.string,
    body: s.string,
  }),
  output: s.object({
    label: s.enum("bug", "feature", "question", "docs"),
    confidence: s.enum("low", "medium", "high"),
  }),
});

await classifyIssue({
  title: "Crash on start",
  body: "segfault",
});

export default classifyIssue;
