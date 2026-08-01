# 347 - Gitignore Pattern Tester

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Analyze .gitignore patterns and report on tracked, ignored, and untracked files.
const gitignorePatternTester = agent({
  model: "small",
  instructions: p`You are a .gitignore pattern analyzer.

Gitignore contents:
${p.readOptional(".gitignore")}

Ignored files:
${p.bash("git ls-files --others --exclude-standard --ignored 2>/dev/null | head -50")}

Tracked files:
${p.bash("git ls-files 2>/dev/null | head -50")}

${defineTool("classifyPattern", {
  description: "Classify a .gitignore pattern",
  parameters: s.object({ pattern: s.string }),
  handler: (args) => {
    const isNegated = args.pattern.startsWith("!");
    const isDirectory = args.pattern.endsWith("/");
    const isGlob = args.pattern.includes("*");
    return {
      isNegated,
      isDirectory,
      isGlob,
      scope: isDirectory ? "directory" as const : "file" as const,
    };
  },
})}

Analyze all patterns from .gitignore, count ignored and tracked files, and return the structured result.`,
  output: s.object({
    patterns: s.array(s.object({
      pattern: s.string,
      isNegated: s.boolean,
      isDirectory: s.boolean,
      scope: s.string,
    })),
    totalPatterns: s.int,
    ignoredFileCount: s.int,
    trackedFileCount: s.int,
  }),
  addons: [repair()],
});

export default gitignorePatternTester;
```
