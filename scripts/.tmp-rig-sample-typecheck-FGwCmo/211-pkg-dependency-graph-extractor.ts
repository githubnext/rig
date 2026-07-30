import { agent, p, s, defineTool } from "rig";

const classifyDependency = defineTool("classifyDependency", {
  description: "Classify a dependency as runtime, dev, or peer given its presence in package.json sections",
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

// Agent role: extract and classify direct dependencies from package.json and describe the dependency tree shape.
const pkgDependencyGraphExtractor = agent({
  model: "typecheck",
  instructions: p`Read the project manifest: ${p.read("package.json")}. Get the resolved dependency tree: ${p.bash("npm ls --json --depth=1 2>/dev/null || echo '{}'")}. Use the classifyDependency tool for each direct dependency found in the manifest. List all devDependency names as plain strings. Classify treeShape as flat (fewer than 5 total direct deps), shallow (5–20), or deep (more than 20). Set depthScore to the total direct dependency count across all sections.`,
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

export default pkgDependencyGraphExtractor;
