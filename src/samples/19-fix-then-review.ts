import { agent, p, s } from "rig";
// Agent role: return a complete replacement for the target file.
const patcher = agent({
    model: "mini",
    input: s.object({
        diagnosis: s.string,
        file: s.string,
        contents: s.string
    }),
    output: s.object({
        path: s.string,
        contents: s.string,
        summary: s.string
    }),
    instructions: `Return a complete replacement for the target file.`,
});
await patcher({
    diagnosis: "The parser accepts trailing prose after JSON.",
    file: "src/index.ts",
    contents: p.read("src/index.ts"),
});

export default patcher;
