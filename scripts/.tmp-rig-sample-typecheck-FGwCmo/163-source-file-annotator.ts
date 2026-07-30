import { agent, p, s } from "rig";

// Agent role: generate JSDoc annotations for TypeScript source files and write annotated output.
const jsDocAnnotator = agent({
  name: "jsDocAnnotator",
  model: "typecheck",
  input: s.object({ filePath: s.path, content: s.string }),
  instructions: p`Add JSDoc comments to every exported function, class, and interface in the TypeScript source. Return only the declared output.`,
  output: s.object({
    annotatedContent: s.string,
    annotationsAdded: s.int,
  }),
});

// Agent role: annotate TypeScript source files with JSDoc comments using a subagent and write results.
const sourceFileAnnotator = agent({
  model: "typecheck",
  agents: { jsDocAnnotator },
  instructions: p`Annotate TypeScript source files with JSDoc comments.

TypeScript files in workspace:
${p.bash("find . -name '*.ts' -not -path '*/node_modules/*' -not -name '*.test.ts' -not -name '*.d.ts' | head -20")}

For each file, read its content, delegate to the jsDocAnnotator subagent, then write the annotated version back using p.write. Track which files were processed successfully and which were skipped.

${p.write("annotated-summary.md", "# Annotation Summary\n<!-- will be filled by agent -->")}

Return only the declared output.`,
  output: s.object({
    filesProcessed: s.int,
    filesSkipped: s.int,
    totalAnnotations: s.int,
    processedPaths: s.array(s.path),
  }),
});

export default sourceFileAnnotator;
