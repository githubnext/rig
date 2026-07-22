import { agent, s } from "rig";
// Agent role: summarize the diff.
const summarizeDiff = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        summary: s.string,
        files: s.array(s.string)
    }),
    instructions: `Summarize the diff.`,
});
// Agent role: review the diff. You may use the provided subagent conceptually.
const reviewer = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        summary: s.string,
        issues: s.array(s.string)
    }),
    agents: { summarizeDiff },
    instructions: `Review the diff. You may use the provided subagent conceptually.`,
});

export default reviewer;
