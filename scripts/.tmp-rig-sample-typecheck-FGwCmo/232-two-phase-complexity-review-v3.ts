import { agent, p, s } from "rig";

// Agent role: extract TypeScript files with line counts from the workspace.
const extractor = agent({
  name: "extractor",
  model: "typecheck",
  instructions: p`List TypeScript source files and their line counts.

Files found: ${p.glob("**/*.ts")}
Line counts: ${p.bash("wc -l $(find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.git/*' | head -20) 2>/dev/null | tail -21")}

Return a list of files with their line counts. Exclude totals and node_modules.`,
  output: s.array(s.object({
    file: s.path,
    lines: s.int,
  })),
});

// Agent role: classify TypeScript files by complexity tier based on line counts.
const reviewer = agent({
  name: "reviewer",
  model: "typecheck",
  instructions: p`You will receive a JSON list of TypeScript files with line counts.
Classify each file's complexity:
- trivial: 0-20 lines
- small: 21-100 lines
- medium: 101-300 lines
- large: 301-600 lines
- huge: 600+ lines

Return the classified list plus a summary.`,
  input: s.array(s.object({ file: s.path, lines: s.int })),
  output: s.object({
    files: s.array(s.object({
      file: s.path,
      lines: s.int,
      complexity: s.enum("trivial", "small", "medium", "large", "huge"),
    })),
    summary: s.object({
      totalFiles: s.int,
      largestFile: s.optional(s.path),
      mostComplex: s.optional(s.path),
    }),
  }),
});

// Agent role: coordinate two-phase TypeScript complexity analysis.
const coordinator = agent({
  model: "typecheck",
  instructions: p`Perform a two-phase TypeScript file complexity analysis:
1. Use the extractor subagent to get a list of TypeScript files with line counts.
2. Pass the extractor's output as input to the reviewer subagent for complexity classification.
3. Return the reviewer's output as your final result.`,
  output: s.object({
    files: s.array(s.object({
      file: s.path,
      lines: s.int,
      complexity: s.enum("trivial", "small", "medium", "large", "huge"),
    })),
    summary: s.object({
      totalFiles: s.int,
      largestFile: s.optional(s.path),
      mostComplex: s.optional(s.path),
    }),
  }),
  agents: { extractor, reviewer },
});

export default coordinator;
