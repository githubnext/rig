import { agent, s } from "rig";
// Agent role: convert the finding into a typed review record.
const reviewRecord = agent({
    model: "mini",
    output: s.object({
        kind: s.enum("review-finding"),
        finding: s.string,
        severity: s.enum("info", "warning", "error")
    }),
    instructions: `Convert the finding into a typed review record.`,
});

export default reviewRecord;
