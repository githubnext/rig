import { agent, p, s } from "rig";
// Agent role: create a focused validation plan for the current changes.
const planner = agent({
    model: "github-copilot/gpt-5.4-mini",
    input: s.object({
        diff: s.string,
        packageJson: s.string
    }),
    output: s.object({
        commands: s.array(s.string),
        manualChecks: s.array(s.string),
        rationale: s.string
    }),
    instructions: `Create a focused validation plan for the current changes.`,
});
await planner({
    diff: p.bash("git diff -- ."),
    packageJson: p.read("package.json"),
});

export default planner;
