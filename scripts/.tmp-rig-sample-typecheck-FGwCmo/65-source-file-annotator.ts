import { agent, p, s } from "rig";

// Agent role: generate JSDoc comments for the TypeScript source file provided.
const jsdocWriter = agent({
  model: "typecheck",
  input: s.object({ path: s.nonEmptyString, source: s.string }),
  output: s.object({ annotated: s.string }),
  instructions: "Add JSDoc comments to all exported functions and classes in the source file. Return only the annotated source.",
});

// Agent role: annotate TypeScript source files with JSDoc using a subagent, then write the results.
const annotator = agent({
  model: "typecheck",
  instructions: p`Annotate each TypeScript file found by ${p.glob("src/**/*.ts")} using the jsdocWriter subagent, then write each annotated file back with ${p.write("src/annotated.ts", "placeholder")}. Hard-code the output path in the report.`,
  output: s.object({
    processed: s.array(s.nonEmptyString),
    skipped: s.array(s.nonEmptyString),
    reportPath: s.string,
  }),
  agents: { jsdocWriter },
});

export default annotator;
