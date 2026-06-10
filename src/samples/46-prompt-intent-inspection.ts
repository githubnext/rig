import { agent, p, s } from "rig";
// Agent role: suggest owners for changed files.
const owners = agent({
    model: "mini",
    input: s.object({
        codeowners: s.string,
        changedFiles: s.string
    }),
    output: s.object({
        owners: s.array(s.string),
        unmatchedFiles: s.array(s.string)
    }),
    instructions: `Suggest owners for changed files.`,
});
await owners({
    codeowners: p.read(".github/CODEOWNERS"),
    changedFiles: p.bash("git diff --name-only origin/main...HEAD"),
});

export default owners;
