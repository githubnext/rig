import { agent, p, s } from "rig";
// Agent role: plan safe dependency upgrades.
const upgradePlan = agent({
    model: "mini",
    input: s.object({
        packageJson: s.string,
        outdated: s.string
    }),
    output: s.object({
        upgrades: s.array(s.object({
            package: s.string,
            from: s.string,
            to: s.string,
            risk: s.string
        })),
        order: s.array(s.string)
    }),
    instructions: `Plan safe dependency upgrades.`,
});
await upgradePlan({
    packageJson: p.read("package.json"),
    outdated: p.bash("npm outdated || true"),
});

export default upgradePlan;
