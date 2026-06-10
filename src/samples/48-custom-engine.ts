import { agent, s } from "rig";

// Agent role: review the provided input and return the declared output.

const review = agent({
  model: "mini",
  output: s.object({
    summary: s.string,
    risk: s.enum("low", "medium", "high"),
  }),
});

await review("...");

export default review;
