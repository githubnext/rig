import { agent, p, s, steering } from "rig";

// Agent role: audit test file naming conventions and report files that violate the standard pattern.
const testNamingEnforcerV2 = agent({
  model: "typecheck",
  instructions: p`Find all test files: ${p.bash("find . \\( -name '*.test.ts' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' -o -name '*.test.tsx' -o -name '*.spec.tsx' \\) -not -path '*/node_modules/*' | head -80")}. For each file classify the naming convention: correct if the filename follows <subject>.test.<ext> or <subject>.spec.<ext>, wrong-prefix if the prefix before the dot is unusual, wrong-suffix if the extension or suffix is non-standard, missing-spec if the file appears to be a test but lacks a .test. or .spec. marker. Provide suggestedName only when a correction is needed. Set allConform to true only when every file is classified as correct.`,
  output: s.object({
    files: s.record(s.object({
      convention: s.enum("correct", "wrong-prefix", "wrong-suffix", "missing-spec"),
      suggestedName: s.optional(s.string),
    })),
    allConform: s.boolean,
  }),
  maxTurns: 5,
  addons: steering({ message: "Ensure every discovered test file has an entry and allConform reflects all entries." }),
});

export default testNamingEnforcerV2;
