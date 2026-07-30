import { agent, s } from "rig";
// Agent role: explain when to launch rig with --server.
const review = agent({
  model: "typecheck",
  instructions: "Explain when to launch rig with --server instead of connecting to an HTTP Copilot server.",
  output: s.object({ summary: s.string, recommendedMode: s.enum("http", "server") }),
});
export default review;
