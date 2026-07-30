import { agent, s } from "rig";
// Agent role: summarize the current git workspace changes.
const promptIntents = agent({
  model: "typecheck",
  instructions: "Summarize the current git workspace changes.",
  output: s.object({
    summary: s.string,
    changedFiles: s.array(s.string),
  }),
});
export default promptIntents;
