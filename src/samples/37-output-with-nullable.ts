import { agent, s } from "rig";
// Agent role: summarize the diff.
const summarizeDiff = agent({
    model: "mini",
    output: s.object({
        summary: s.string,
        files: s.array(s.string)
    }),
    instructions: `Summarize the diff.`,
});
// Agent role: review the diff. You may use the provided subagent conceptually.
const reviewer = agent({
    model: "mini",
    output: s.object({
        summary: s.string,
        issues: s.array(s.string)
    }),
    agents: { summarizeDiff },
    instructions: `Review the diff. You may use the provided subagent conceptually.`,
});

export default reviewer;
