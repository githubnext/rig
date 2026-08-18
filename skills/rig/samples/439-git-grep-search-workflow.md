# git-grep-search-workflow - Git Grep Search Workflow

```rig
import { workflow, agent, p, s } from "rig";

// Agent role: search the git repository for lines matching a pattern.
const patternSearcher = agent({
  model: "small",
  input: s.object({ pattern: s.string }),
  output: s.object({
    matches: s.array(s.object({ file: s.string, line: s.int, content: s.string })),
    totalMatches: s.int,
  }),
  instructions: p`Run ${p.bash('git grep -n "$1" -- "*.ts" 2>/dev/null || true')} where $1 is replaced by input.pattern. Parse each output line (format: file:lineNumber:content) into structured matches. Return matches array and totalMatches.`,
});

// Agent role: classify each code match as a comment, string literal, or code reference.
const matchClassifier = agent({
  model: "small",
  input: s.object({
    matches: s.array(s.object({ file: s.string, line: s.int, content: s.string })),
  }),
  output: s.object({
    classified: s.array(s.object({
      file: s.string,
      line: s.int,
      content: s.string,
      kind: s.enum("comment", "string", "code"),
    })),
    commentMatches: s.int,
    codeMatches: s.int,
    stringMatches: s.int,
  }),
  instructions: `For each match classify whether the pattern appears in: a comment (line contains // or is inside /* */), a string literal (surrounded by quotes), or code. Return classified array plus counts for each kind.`,
});

// Workflow role: run git grep for a pattern then classify each match by context.
export default workflow({
  meta: { name: "git-grep-search-workflow", description: "Search for a pattern in TypeScript source files and classify each match." },
  input: s.object({ pattern: s.string }),
  body: async ({ call, input }) => {
    const r1 = await call(patternSearcher, input);
    if (!r1) return null;
    return call(matchClassifier, { matches: r1.matches });
  },
});
```
