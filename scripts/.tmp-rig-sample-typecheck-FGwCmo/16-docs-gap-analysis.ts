import { agent, s } from "rig";
// Agent role: compare public API declarations and identify breaking changes.
const apiDiff = agent({
    model: "typecheck",
    output: s.object({
        breaking: s.boolean,
        summary: s.string,
        changes: s.array(s.string)
    }),
    instructions: `Compare public API declarations and identify breaking changes.`,
});
export default apiDiff;
