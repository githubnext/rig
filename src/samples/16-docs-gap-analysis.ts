import { agent, p, s } from "rig";
// Agent role: compare public API declarations and identify breaking changes.
const apiDiff = agent({
    model: "mini",
    input: s.object({
        before: s.string,
        after: s.string
    }),
    output: s.object({
        breaking: s.boolean,
        summary: s.string,
        changes: s.array(s.string)
    }),
    instructions: `Compare public API declarations and identify breaking changes.`,
});
await apiDiff({
    before: p.bash("git show origin/main:dist/index.d.ts"),
    after: p.read("dist/index.d.ts"),
});

export default apiDiff;
