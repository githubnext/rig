# 413 - Gitignore Pattern Analyzer

```rig
import { agent, p, s, repair, defineTool } from "rig";

const classifyPattern = defineTool("classifyPattern", {
  description: "Classify a .gitignore pattern as negated, directory, or glob.",
  parameters: s.object({ pattern: s.string }),
  handler: ({ pattern }: { pattern: string }) => {
    const isNegated = pattern.startsWith("!");
    const clean = isNegated ? pattern.slice(1) : pattern;
    const isDirectory = clean.endsWith("/");
    const isGlob = clean.includes("*") || clean.includes("?");
    return { isNegated, isDirectory, isGlob };
  },
});

// Agent role: Read .gitignore and classify each pattern, then count ignored vs tracked files.
const gitignorePatternAnalyzer = agent({
  model: "small",
  instructions: p`.gitignore contents:
${p.readOptional(".gitignore")}

Ignored files:
${p.bash("git ls-files --others --ignored --exclude-standard 2>/dev/null | wc -l")}

Tracked files:
${p.bash("git ls-files 2>/dev/null | wc -l")}

For each pattern line (non-empty, non-comment), call classifyPattern. Return all classified patterns along with totalPatterns, ignoredFileCount, and trackedFileCount.`,
  tools: [classifyPattern],
  output: s.object({
    patterns: s.array(s.object({
      pattern: s.string,
      isNegated: s.boolean,
      isDirectory: s.boolean,
      isGlob: s.boolean,
    })),
    totalPatterns: s.int,
    ignoredFileCount: s.int,
    trackedFileCount: s.int,
  }),
  addons: [repair()],
});

export default gitignorePatternAnalyzer;

```
