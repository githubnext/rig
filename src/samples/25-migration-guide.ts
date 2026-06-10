import { agent, s } from "rig";
// Agent role: rewrite the error to be actionable and precise.
const improve = agent({
    model: "mini",
    input: s.object({
        message: s.string,
        context: s.optional(s.string)
    }),
    output: s.object({
        message: s.string,
        explanation: s.string
    }),
    instructions: `Rewrite the error to be actionable and precise.`,
});
await improve({
    message: "bad output",
    context: "Validation failed for optional underscore field.",
});

export default improve;
