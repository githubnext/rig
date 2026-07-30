import { agent, s } from "rig";

// Agent role: classify the issue.

const classifyIssue = agent({
  model: "typecheck",
  instructions: "Classify the issue.",
  output: s.object({
    label: s.enum("bug", "feature", "question", "docs"),
    confidence: s.enum("low", "medium", "high"),
  }),
});

export default classifyIssue;
