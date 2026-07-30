import { agent, timeout } from "rig";
// Agent role: return a short response before the timeout expires.
const worker = agent({
  model: "typecheck",
  instructions: "Return a short response before the timeout expires.",
  addons: timeout({ timeout: 5_000 }),
});
export default worker;
