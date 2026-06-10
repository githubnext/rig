import { agent, p, s } from "rig";

// Agent role: summarize the current git workspace changes.

const promptIntents = agent({
  model: "mini",
  instructions: "Summarize the current git workspace changes.",
  input: s.object({
    diff: s.string,
    status: s.string,
  }),
  output: s.object({
    summary: s.string,
    changedFiles: s.array(s.string),
  }),
});

await promptIntents({
  diff: p.bash("git diff -- ."),
  status: p.bash("git status --short"),
});

export default promptIntents;
