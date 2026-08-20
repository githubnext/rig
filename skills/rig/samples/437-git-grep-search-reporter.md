# 437 - Git Grep Search Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseGrepLine = defineTool("parseGrepLine", {
  description: "Parse a single line of git grep output into file, line number, and snippet",
  parameters: s.object({ line: s.string }),
  handler: async ({ line }) => {
    const match = line.match(/^([^:]+):(\d+):(.*)$/);
    if (!match) return { file: line, lineNumber: 0, snippet: line };
    return { file: match[1], lineNumber: parseInt(match[2], 10), snippet: match[3].trim() };
  },
});

// Agent role: Search code in the repository using git grep and report structured match results.
const gitGrepSearchReporter = agent({
  name: "git-grep-search-reporter",
  model: "small",
  maxTurns: 5,
  input: s.object({ pattern: s.string, extensions: s.array(s.string) }),
  instructions: p`You are a code search reporter. Run git grep for each extension from input.extensions using the pattern from input.pattern. Here is the git grep output for all extensions combined:
${p.bash("git grep -n -E . -- 'src/' 2>/dev/null | head -100 || echo 'no matches'")}

Actually use the input pattern and extensions: call parseGrepLine on each grep output line. Then return matches array (each with file, line s.int, snippet), totalMatches, and filesHit (distinct file count).`,
  output: s.object({
    matches: s.array(s.object({ file: s.path, line: s.int, snippet: s.string })),
    totalMatches: s.int,
    filesHit: s.int,
  }),
  tools: [parseGrepLine],
  addons: [repair()],
});

export default gitGrepSearchReporter;
```
