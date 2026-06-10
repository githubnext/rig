import { agent, p, s } from "rig";
// Agent role: plan a minimal, low-risk refactor. Do not edit files.
const refactorPlan = agent({
    model: "mini",
    input: s.object({
        files: s.string,
        target: s.string
    }),
    output: s.object({
        steps: s.array(s.string),
        files: s.array(s.string),
        risks: s.array(s.string)
    }),
    instructions: `Plan a minimal, low-risk refactor. Do not edit files.`,
});
await refactorPlan({
    files: p.bash("find src -type f | sort"),
    target: "Split validation helpers out of the main runtime file.",
});

export default refactorPlan;
