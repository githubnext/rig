import { agent, p, s } from "rig";
// Agent role: draft a GitHub bug report from the failure details.
const bugReport = agent({
    model: "mini",
    input: s.object({
        failure: s.string,
        environment: s.string
    }),
    output: s.object({
        title: s.string,
        body: s.string,
        labels: s.array(s.string)
    }),
    instructions: `Draft a GitHub bug report from the failure details.`,
});
await bugReport({
    failure: p.bash("npm test 2>&1 || true"),
    environment: p.bash("node --version && npm --version && uname -a"),
});

export default bugReport;
