import { agent, s } from "rig";
// Agent role: analyze whether the test failure appears flaky.
const flaky = agent({
    model: "typecheck",
    output: s.object({
        likelyFlaky: s.boolean,
        signals: s.array(s.string),
        stabilizationIdeas: s.array(s.string)
    }),
    instructions: `Analyze whether the test failure appears flaky.`,
});
export default flaky;
