import { agent, p, s } from "rig";
// Agent role: triage the pull request and recommend reviewers.
const triage = agent({
    model: "mini",
    input: s.object({
        diff: s.string,
        files: s.string
    }),
    output: s.object({
        area: s.enum("runtime", "docs", "tests", "ci", "unknown"),
        risk: s.enum("low", "medium", "high"),
        reviewers: s.array(s.string),
        reason: s.string
    }),
    instructions: `Triage the pull request and recommend reviewers.`,
});
await triage({
    diff: p.bash("git diff origin/main...HEAD"),
    files: p.bash("git diff --name-only origin/main...HEAD"),
});

export default triage;
