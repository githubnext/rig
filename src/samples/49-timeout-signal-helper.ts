import { agent } from "rig";
import { timeout } from "rig/addons";

// Agent role: return a short response in output.text.

const worker = agent({
  model: "mini",
  instructions: `Return a short response in output.text.`,
  addons: timeout({ timeout: 5_000 }),
});

export default worker;
