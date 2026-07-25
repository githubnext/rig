# 159 - Ts Branch Coverage

```rig
import { agent, p, s } from "rig";

// Agent role: identify branch statements in a TypeScript file and estimate coverage.
const branchAnalyzer = agent({
  name: "branchAnalyzer",
  model: "nano",
  input: s.string,
  instructions: p`Analyze the TypeScript source code provided and identify all branch points.

For each branch (if statements, ternaries, switch cases, nullish coalescing), determine:
- functionName: the enclosing function name (or "module" if top-level)
- line: approximate line number
- branchType: "if", "ternary", "switch", or "nullish"
- covered: false (assume uncovered unless the code contains obvious test guards)

Return only the declared output array.`,
  output: s.array(
    s.object({
      functionName: s.string,
      line: s.int,
      branchType: s.enum("if", "ternary", "switch", "nullish"),
      covered: s.boolean,
    })
  ),
});

// Agent role: coordinate branch coverage analysis by delegating to branchAnalyzer subagent.
const tsBranchCoverage = agent({
  model: "small",
  input: s.object({ filePath: s.path }),
  instructions: p`Analyze TypeScript branch coverage for the file at the provided path.

File content:
${p.readInput("filePath")}

Delegate the analysis to the branchAnalyzer subagent. Then aggregate results into:
- branches: the full array returned by branchAnalyzer
- summary: totalBranches (length of array), coveredBranches (count where covered=true),
  uncoveredBranches (count where covered=false)`,
  agents: { branchAnalyzer },
  output: s.object({
    branches: s.array(
      s.object({
        functionName: s.string,
        line: s.int,
        branchType: s.enum("if", "ternary", "switch", "nullish"),
        covered: s.boolean,
      })
    ),
    summary: s.object({
      totalBranches: s.int,
      coveredBranches: s.int,
      uncoveredBranches: s.int,
    }),
  }),
});

export default tsBranchCoverage;
```
