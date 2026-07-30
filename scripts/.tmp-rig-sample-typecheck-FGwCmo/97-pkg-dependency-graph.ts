import { agent, p, s, defineTool } from "rig";

const classifyDependency = defineTool("classifyDependency", {
  description: "Classify a dependency as runtime, dev, or peer based on its presence in package.json sections",
  parameters: s.object({
    name: s.string,
    inDependencies: s.boolean,
    inDevDependencies: s.boolean,
    inPeerDependencies: s.boolean,
  }),
  handler({ inDependencies, inDevDependencies, inPeerDependencies }) {
    if (inPeerDependencies) return "peer";
    if (inDevDependencies) return "dev";
    if (inDependencies) return "runtime";
    return "dev";
  },
});

// Agent role: extract and classify direct dependencies from package.json, then describe the overall tree shape.
const pkgDependencyGraph = agent({
  model: "typecheck",
  instructions: p`Read the project manifest: ${p.read("package.json")}. Get the resolved dependency tree using ${p.bash("npm ls --json --depth=1 2>/dev/null || echo '{}'")}. Use the classifyDependency tool to classify each direct dependency as runtime, dev, or peer. Also list all devDependency names. Estimate the treeShape as flat (<5 deps), shallow (5–20), or deep (>20) and set depthScore to the total direct dependency count.`,
  output: s.object({
    directDeps: s.array(s.object({
      name: s.string,
      version: s.string,
      type: s.enum("runtime", "dev", "peer"),
    })),
    devDeps: s.array(s.string),
    treeShape: s.enum("flat", "shallow", "deep"),
    depthScore: s.number,
  }),
  tools: [classifyDependency],
});

export default pkgDependencyGraph;
