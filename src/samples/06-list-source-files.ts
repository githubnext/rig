import { agent, p, s } from "rig";
// Agent role: confirm whether the write intent succeeded.
const writer = agent({
    model: "mini",
    input: s.object({
        write: s.object({
            ok: s.boolean,
            stdout: s.string,
            stderr: s.string,
            exitCode: s.number
        })
    }),
    output: s.object({
        written: s.boolean,
        summary: s.string
    }),
    instructions: `
    Confirm whether the write intent succeeded.
  `,
});
await writer({
    write: p.write("README.md", "# Project\n\nGenerated README.\n", {
        purpose: "create project README",
    }),
});

export default writer;
