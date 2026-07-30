import { agent, p, s } from "rig";

const branchItem = s.object({
  functionName: s.string,
  line: s.int,
  branchType: s.enum("if", "ternary", "switch", "nullish"),
  covered: s.boolean,
});

// Agent role: extract all branch points from the provided TypeScript source code.
const branchAnalyzer = agent({
  model: "typecheck",
  instructions: p`Analyze the TypeScript source code provided in the input and list every branch point (if/ternary/switch/nullish coalescing). For each branch, identify the enclosing function name, line number, branch type, and whether it appears covered (has a test or usage path). Return an array of branch objects.`,
  input: s.object({ filePath: s.path }),
  output: s.array(branchItem),
});

// Agent role: coordinate branch coverage analysis for a TypeScript file.
const tsBranchCoverageAnalyzer = agent({
  model: "typecheck",
  input: s.object({ filePath: s.path }),
  instructions: p`Perform branch coverage analysis on a TypeScript file.

File content:
${p.readInput("filePath")}

Delegate the analysis to the branchAnalyzer subagent, passing the filePath.
Collect its output (an array of branch objects), then compute a summary with totalBranches, coveredBranches, and uncoveredBranches counts.`,
  output: s.object({
    branches: s.array(branchItem),
    summary: s.object({
      totalBranches: s.int,
      coveredBranches: s.int,
      uncoveredBranches: s.int,
    }),
  }),
  agents: { branchAnalyzer },
});

export default tsBranchCoverageAnalyzer;
