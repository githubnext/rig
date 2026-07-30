import { agent, s } from "rig";
// Agent role: find documentation gaps against the source API.
const docsGap = agent({
    model: "typecheck",
    output: s.object({
        missing: s.array(s.string),
        stale: s.array(s.string),
        quickFixes: s.array(s.string)
    }),
    instructions: `Find documentation gaps against the source API.`,
});
export default docsGap;
