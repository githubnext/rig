import { agent } from "rig";

// Agent role: return a short response within a time budget.

const worker = agent({
  model: "mini",
  instructions: `Return a short response.`,
});

export default worker;
