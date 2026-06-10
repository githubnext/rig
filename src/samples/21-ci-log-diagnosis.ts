import { agent, s } from "rig";
// Agent role: extract a clear reproduction from the issue.
const reproducer = agent({
    model: "mini",
    input: s.object({
        issueTitle: s.string,
        issueBody: s.string
    }),
    output: s.object({
        steps: s.array(s.string),
        expected: s.string,
        actual: s.string,
        missingInfo: s.array(s.string)
    }),
    instructions: `Extract a clear reproduction from the issue.`,
});
await reproducer({
    issueTitle: "Install fails on Windows",
    issueBody: "npm install errors with EPERM when postinstall runs.",
});

export default reproducer;
