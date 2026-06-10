import { agent, p, s } from "rig";
// Agent role: review dependency security posture from the provided outputs.
const securityReview = agent({
    model: "mini",
    input: s.object({
        dependencies: s.string,
        audit: s.string
    }),
    output: s.object({
        status: s.enum("clean", "needs-action", "unknown"),
        findings: s.array(s.object({
            package: s.string,
            severity: s.string,
            action: s.string
        }))
    }),
    instructions: `Review dependency security posture from the provided outputs.`,
});
await securityReview({
    dependencies: p.bash("npm ls --depth=0"),
    audit: p.bash("npm audit --json", { purpose: "security audit" }),
});

export default securityReview;
