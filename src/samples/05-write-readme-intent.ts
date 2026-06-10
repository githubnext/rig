import { agent, p, s } from "rig";
// Agent role: generate a concise README for the package. Include install, usage, and API sections.
const readmeWriter = agent({
    model: "mini",
    input: s.object({
        packageJson: s.string,
        files: s.string
    }),
    output: s.object({
        path: s.enum("README.md"),
        contents: s.string
    }),
    instructions: `
    Generate a concise README for the package.
    Include install, usage, and API sections.
  `,
});
await readmeWriter({
    packageJson: p.read("package.json"),
    files: p.bash("find . -maxdepth 2 -type f | sort"),
});

export default readmeWriter;
