import { agent, p, s } from "rig";
// Agent role: review input.diff for correctness and regression risks. Return only the declared output shape.
const reviewer = agent({
    model: "mini",
    input: s.object({
        diff: s.string,
        status: s.optional(s.string)
    }),
    output: s.object({
        summary: s.string,
        risk: s.enum("low", "medium", "high"),
        findings: s.array(s.object({
            severity: s.enum("info", "warning", "error"),
            message: s.string,
            file: s.optional(s.string),
            line: s.optional(s.number)
        })),
        tests: s.array(s.string)
    }),
    instructions: `
    Review input.diff for correctness and regression risks.
    Return only the declared output shape.
  `,
});
await reviewer({
    diff: p.bash("git diff -- ."),
    status: p.bash("git status --short"),
});

export default reviewer;
