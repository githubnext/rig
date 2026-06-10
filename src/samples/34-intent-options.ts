import { agent, p, s } from "rig";
// Agent role: investigate the project using only readonly evidence.
const investigator = agent({
    model: "mini",
    input: s.object({
        tree: s.string,
        packageJson: s.string,
        tests: s.string
    }),
    output: s.object({
        observations: s.array(s.string),
        likelyEntryPoints: s.array(s.string)
    }),
    instructions: `Investigate the project using only readonly evidence.`,
});
await investigator({
    tree: p.bash("find . -maxdepth 3 -type f | sort"),
    packageJson: p.read("package.json"),
    tests: p.bash("find . -name '*test*' -o -name '*spec*'"),
});

export default investigator;
