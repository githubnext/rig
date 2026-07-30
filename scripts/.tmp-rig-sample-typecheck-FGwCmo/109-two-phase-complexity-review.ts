import { agent, p, s } from "rig";

// Agent role: extract TypeScript function names and line counts from source files.
const extractor = agent({
  name: "extractor",
  model: "typecheck",
  instructions: p`Scan TypeScript source files: ${p.bash("grep -rn --include='*.ts' 'function \\|=>.*(\\|async ' . | grep -v node_modules | grep -v '.test.' | head -60")}. For each function found, estimate its line count by looking at surrounding context. Return a JSON object mapping function names to their approximate line counts.`,
  output: s.record(s.number),
});

// Agent role: classify function complexity based on line counts and produce a summary report.
const complexityReviewer = agent({
  name: "complexityReviewer",
  model: "typecheck",
  instructions: p`Delegate to extractor to obtain a JSON record of function names to line counts. Classify each function as: simple (<10 lines), moderate (10-29), complex (30-59), or critical (≥60). Count the total number of complex+critical functions for the summary.`,
  output: s.object({
    functions: s.record(s.object({
      lineCount: s.number,
      complexity: s.enum("simple", "moderate", "complex", "critical"),
    })),
    summary: s.object({
      totalFunctions: s.number,
      complexCount: s.number,
    }),
  }),
  agents: { extractor },
});

export default complexityReviewer;
