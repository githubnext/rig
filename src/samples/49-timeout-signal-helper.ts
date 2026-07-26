import { agent, timeout } from "rig";

// Agent role: return a short response in output.text.

const worker = agent({
  model: "mini",
  instructions: `Return a short response in output.text.`,
  addons: timeout({ timeout: 5_000 }),
});

export default worker;
