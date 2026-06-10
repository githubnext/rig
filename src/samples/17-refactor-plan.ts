import { agent, p, s } from "rig";
// Agent role: find documentation gaps against the source API.
const docsGap = agent({
    model: "mini",
    input: s.object({
        source: s.string,
        docs: s.string
    }),
    output: s.object({
        missing: s.array(s.string),
        stale: s.array(s.string),
        quickFixes: s.array(s.string)
    }),
    instructions: `Find documentation gaps against the source API.`,
});
await docsGap({
    source: p.bash("grep -R \"export \" -n src || true"),
    docs: p`${p.read("README.md")}\n${p.read("docs/*.md")}`,
});

export default docsGap;
