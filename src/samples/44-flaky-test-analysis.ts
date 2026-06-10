import { agent, p, s } from "rig";
// Agent role: decide whether snapshot updates are legitimate.
const snapshotReview = agent({
    model: "mini",
    input: s.object({
        testResult: s.string,
        diff: s.string
    }),
    output: s.object({
        safeToUpdate: s.boolean,
        reason: s.string,
        command: s.optional(s.string)
    }),
    instructions: `Decide whether snapshot updates are legitimate.`,
});
await snapshotReview({
    testResult: p.bash("npm test -- --runInBand"),
    diff: p.bash("git diff -- '*snap*'"),
});

export default snapshotReview;
