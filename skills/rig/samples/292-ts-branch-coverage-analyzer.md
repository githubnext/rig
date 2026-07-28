# 292-ts-branch-coverage-analyzer - Ts Branch Coverage Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: analyze TypeScript source for branch coverage patterns
const branchAnalyzer = agent({
  name: "branchAnalyzer",
  model: "small",
  instructions: p`Analyze the TypeScript source provided in the input and identify all branches (if/ternary/switch/logical). For each branch, determine the function name, line number, branch type, and whether it is likely covered based on test presence. Return a detailed array of branch objects.`,
  input: s.object({ source: s.string }),
  output: s.array(s.object({
    functionName: s.string,
    line: s.int,
    branchType: s.enum("if", "ternary", "switch", "logical"),
    covered: s.boolean,
  })),
});

// Agent role: coordinate branch coverage analysis for a TypeScript file
const tsBranchCoverageAnalyzer = agent({
  model: "small",
  instructions: p`Read the TypeScript file at the path in the input using the readInput intent and delegate branch analysis to the branchAnalyzer subagent. Compute totalBranches, coveredBranches, and uncoveredBranches from the results.`,
  input: s.object({ filePath: s.path }),
  output: s.object({
    branches: s.array(s.object({
      functionName: s.string,
      line: s.int,
      branchType: s.enum("if", "ternary", "switch", "logical"),
      covered: s.boolean,
    })),
    summary: s.object({
      totalBranches: s.int,
      coveredBranches: s.int,
      uncoveredBranches: s.int,
    }),
  }),
  agents: { branchAnalyzer },
});

export default tsBranchCoverageAnalyzer;
```
