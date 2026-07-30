import { agent, p, s } from "rig";

// Agent role: extract TypeScript function names and approximate line counts from source files.
const extractor = agent({
  name: "extractor",
  model: "typecheck",
  instructions: p`Scan TypeScript files: ${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -name '*.d.ts' | head -20")}. For each file, find function and arrow-function definitions: ${p.bash("grep -rn --include='*.ts' -E '^(export )?(async )?function |const [a-zA-Z]+ = (async )?(\\([^)]*\\)|[a-zA-Z]+) =>' . | grep -v node_modules | head -80")}. Estimate line count per function from surrounding context. Return a record mapping functionName to approximate lineCount.`,
  output: s.record(s.int),
});

// Agent role: rate each TypeScript function for complexity and produce an aggregate summary.
const twoPhaseComplexityReview = agent({
  name: "twoPhaseComplexityReview",
  model: "typecheck",
  instructions: p`Delegate to the extractor subagent to get a record of function names and line counts. Classify each function: simple (<10 lines), moderate (10–29 lines), complex (30–59 lines), or critical (≥60 lines). Count functions rated complex or critical for summary.complexCount.`,
  output: s.object({
    functions: s.record(s.object({
      lineCount: s.int,
      complexity: s.enum("simple", "moderate", "complex", "critical"),
    })),
    summary: s.object({
      totalFunctions: s.int,
      complexCount: s.int,
    }),
  }),
  agents: { extractor },
  maxTurns: 6,
});

export default twoPhaseComplexityReview;
