import { agent, s } from "rig";
// Agent role: review the workflow for reliability, caching, and least privilege.
const actionReview = agent({
    model: "typecheck",
    output: s.object({
        summary: s.string,
        problems: s.array(s.string),
        improvements: s.array(s.string)
    }),
    instructions: `Review the workflow for reliability, caching, and least privilege.`,
});
export default actionReview;
