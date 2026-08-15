# 420 - Changelog Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Collect the 10 most recent git commits.
const commitCollector = agent({
  model: "small",
  instructions: p`Recent git commits:
${p.bash("git log --oneline -10 2>/dev/null")}

Return each commit as a single string (hash + message).`,
  output: s.object({
    commits: s.array(s.string),
  }),
});

// Agent role: Classify each commit string into a conventional commit category.
const commitClassifier = agent({
  model: "small",
  input: s.object({ commits: s.array(s.string) }),
  instructions: p`Classify each commit in the input by its conventional commit type. Return classified array with commit and category.`,
  output: s.object({
    classified: s.array(s.object({
      commit: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
  }),
});

// Agent role: Format a CHANGELOG entry from classified commits.
const changelogFormatter = agent({
  model: "small",
  input: s.object({
    classified: s.array(s.object({
      commit: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
  }),
  instructions: p`Format a CHANGELOG entry from the classified commits. Group by category. Return changelogEntry (markdown string), commitCount, and categories (map of category to count).`,
  output: s.object({
    changelogEntry: s.string,
    commitCount: s.int,
    categories: s.record(s.int),
  }),
});

// Workflow role: Collect, classify, and format git commits into a CHANGELOG entry.
export default workflow({
  meta: {
    name: "changelog-workflow",
    description: "Collect recent commits, classify them, and format a CHANGELOG entry.",
    phases: ["Collect", "Classify", "Format"],
  },
  body: async ({ call, phase }) => {
    phase("Collect");
    const step1 = await call(commitCollector, "Collect recent commits.");
    if (!step1) return null;
    phase("Classify");
    const step2 = await call(commitClassifier, { commits: step1.commits });
    if (!step2) return null;
    phase("Format");
    return call(changelogFormatter, { classified: step2.classified });
  },
});

```
