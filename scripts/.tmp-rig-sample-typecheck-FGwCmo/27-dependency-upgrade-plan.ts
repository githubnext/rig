import { agent, s } from "rig";
// Agent role: review the design proposal for simplicity and maintainability.
const designReview = agent({
    model: "typecheck",
    output: s.object({
        decision: s.enum("approve", "revise", "reject"),
        strengths: s.array(s.string),
        concerns: s.array(s.string),
        requiredChanges: s.array(s.string)
    }),
    instructions: `Review the design proposal for simplicity and maintainability.`,
});

export default designReview;
