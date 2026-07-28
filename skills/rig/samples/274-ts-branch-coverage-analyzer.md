# 274 - Ts Branch Coverage Analyzer

```rig
import { agent, p, s } from "rig";

// Agent role: analyze TypeScript file content to identify branches and their coverage.
const branchAnalyzer = agent({
  model: "small",
  instructions: `Given the TypeScript file content below, identify all branch points.
For each branch, extract: functionName (surrounding function or "module-level"), line number,
branchType (if/ternary/switch/logical/nullish), and covered (true if the branch has a test or always executes).
Return the branches array.`,
  input: s.object({ fileContent: s.string, filePath: s.string }),
  output: s.array(
    s.object({
      functionName: s.string,
      line: s.int,
      branchType: s.enum("if", "ternary", "switch", "logical", "nullish"),
      covered: s.boolean,
    })
  ),
});

// Agent role: coordinate branch coverage analysis for a TypeScript file.
const tsBranchCoverageAnalyzer = agent({
  model: "small",
  input: s.object({ filePath: s.string }),
  instructions: p`Analyze TypeScript branch coverage for the file at the path provided in input.

Read the file content:
${p.readInput("filePath")}

Delegate analysis to the branchAnalyzer subagent passing fileContent and filePath.
Aggregate the results: count totalBranches, coveredBranches, uncoveredBranches.
Compute coveragePercent as (coveredBranches / totalBranches * 100), 0 if no branches.`,
  agents: { branchAnalyzer },
  output: s.object({
    branches: s.array(
      s.object({
        functionName: s.string,
        line: s.int,
        branchType: s.enum("if", "ternary", "switch", "logical", "nullish"),
        covered: s.boolean,
      })
    ),
    summary: s.object({
      totalBranches: s.int,
      coveredBranches: s.int,
      uncoveredBranches: s.int,
      coveragePercent: s.number,
    }),
  }),
});

export default tsBranchCoverageAnalyzer;
```
