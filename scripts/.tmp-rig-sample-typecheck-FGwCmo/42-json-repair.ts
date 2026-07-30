import { agent, s } from "rig";

// Agent role: summarize the diff.

const summarize = agent({
  model: "typecheck",
  instructions: "Summarize the diff.",
  output: s.object({
    summary: s.string,
  }),
  maxTurns: 2,
});

export default summarize;
