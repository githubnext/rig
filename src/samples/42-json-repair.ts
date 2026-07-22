import { agent, s } from "rig";

// Agent role: summarize the diff.

const summarize = agent({
  model: "github-copilot/gpt-5.4-mini",
  instructions: "Summarize the diff.",
  input: s.object({
    diff: s.string,
  }),
  output: s.object({
    summary: s.string,
  }),
  maxTurns: 2,
});

export default summarize;
