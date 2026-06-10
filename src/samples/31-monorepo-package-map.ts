import { agent, p, s } from "rig";
// Agent role: review the workflow for reliability, caching, and least privilege.
const actionReview = agent({
    model: "mini",
    output: s.object({
        summary: s.string,
        problems: s.array(s.string),
        improvements: s.array(s.string)
    }),
    instructions: `Review the workflow for reliability, caching, and least privilege.`,
});
await actionReview(p.read(".github/workflows/*.{yml,yaml}"));

export default actionReview;
