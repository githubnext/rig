import { agent, p, s } from "rig";
// Agent role: parse environment outputs.
const envReader = agent({
    model: "mini",
    input: s.object({
        nodeVersion: s.string,
        cwdFiles: s.string
    }),
    output: s.object({
        nodeMajor: s.number,
        files: s.array(s.string)
    }),
    instructions: `Parse environment outputs.`,
});
await envReader({
    nodeVersion: p.bash("node --version", {
        cwd: ".",
        timeout: 10000,
        purpose: "check Node version",
    }),
    cwdFiles: p.bash("ls -la", {
        env: { FORCE_COLOR: "0" },
        purpose: "list current directory",
    }),
});

export default envReader;
