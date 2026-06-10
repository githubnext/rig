import { agent, p, s } from "rig";

// Agent role: review the repository diff and return a structured summary.

const reviewDiff = agent({
  model: "mini",
  instructions: "Review the repository diff and return a structured summary.",
  input: s.object({
    diff: s.string,
    status: s.string,
  }),
  output: s.object({
    summary: s.string,
    findings: s.array(s.object({
      file: s.string,
      line: s.optional(s.number),
      message: s.string,
    })),
  }),
});

await reviewDiff({
  diff: p.bash("git diff --stat"),
  status: p.bash("git status --short"),
});

export default reviewDiff;
