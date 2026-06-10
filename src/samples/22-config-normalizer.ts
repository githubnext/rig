import { agent, p, s } from "rig";
// Agent role: diagnose the CI log. Prefer the first real failure over cascading errors.
const ciDiagnosis = agent({
    model: "mini",
    output: s.object({
        failure: s.string,
        likelyCause: s.string,
        commandsToTry: s.array(s.string)
    }),
    instructions: `Diagnose the CI log. Prefer the first real failure over cascading errors.`,
});
await ciDiagnosis(p.read("ci.log"));

export default ciDiagnosis;
