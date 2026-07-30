import { agent, p, s, steering } from "rig";

// Agent role: audit test file naming conventions and report files that violate the standard pattern.
const testNamingEnforcer = agent({
  model: "typecheck",
  instructions: p`Find all test files in this project using ${p.bash("find . \\( -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' \\) -not -path '*/node_modules/*' | head -60")}. For each file, check whether it follows the convention of <subject>.test.ts or <subject>.spec.ts. Classify as correct if it matches, wrong-prefix if the name before the extension separator is unusual, wrong-suffix if it ends differently, or missing-spec if it should be a test file but lacks the marker. Suggest a corrected name where applicable. Set allConform to true only if every file is classified as correct.`,
  output: s.object({
    files: s.record(s.object({
      convention: s.enum("correct", "wrong-prefix", "wrong-suffix", "missing-spec"),
      suggestedName: s.optional(s.string),
    })),
    allConform: s.boolean,
  }),
  maxTurns: 5,
  addons: steering({ message: "Ensure every discovered test file has an entry in files and allConform is a boolean." }),
});

export default testNamingEnforcer;
