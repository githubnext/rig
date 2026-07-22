import { agent, p, s } from "rig";
// Agent role: analyze whether the test failure appears flaky.
const flaky = agent({
    model: "github-copilot/gpt-5.4-mini",
    output: s.object({
        likelyFlaky: s.boolean,
        signals: s.array(s.string),
        stabilizationIdeas: s.array(s.string)
    }),
    instructions: `Analyze whether the test failure appears flaky.`,
});
await flaky(p.read("test-runs/*.log"));

export default flaky;
