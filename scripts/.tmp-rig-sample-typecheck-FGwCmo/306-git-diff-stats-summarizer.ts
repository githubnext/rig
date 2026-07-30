import { agent, p, s, defineTool, repair } from "rig";

const classifyDiffEntry = defineTool("classifyDiffEntry", {
  description: "Classify a diff entry based on addition/deletion counts",
  parameters: s.object({ path: s.string, additions: s.int, deletions: s.int }),
  handler({ additions, deletions }) {
    if (additions > 0 && deletions === 0) return "added" as const;
    if (additions === 0 && deletions > 0) return "deleted" as const;
    if (additions > 0 && deletions > 0) return "modified" as const;
    return "renamed" as const;
  },
});

// Agent role: Summarize git diff statistics between the last two commits, classifying each changed file.
const gitDiffStatsSummarizer = agent({
  model: "typecheck",
  instructions: p`Analyze git diff statistics for the most recent commit.

Diff numstat (additions deletions file):
${p.bash("git diff --numstat HEAD~1 HEAD 2>/dev/null | head -30 || echo 'no diff'")}

Diff summary:
${p.bash("git diff --stat HEAD~1 HEAD 2>/dev/null | tail -5 || echo 'no stat'")}

Parse the numstat output (format: additions<TAB>deletions<TAB>path).
Use the classifyDiffEntry tool on each file entry.
Sum up totalAdditions and totalDeletions.
Set mostChangedFile to the file with the highest combined additions+deletions, or omit if empty.
Return the structured output.`,
  output: s.object({
    files: s.array(s.object({
      path: s.string,
      additions: s.int,
      deletions: s.int,
      change: s.enum("added", "modified", "deleted", "renamed"),
    })),
    totalAdditions: s.int,
    totalDeletions: s.int,
    mostChangedFile: s.optional(s.string),
  }),
  tools: [classifyDiffEntry],
  addons: [repair()],
});

export default gitDiffStatsSummarizer;
