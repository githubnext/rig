# 476 - Changelog Entry Workflow

```rig
import { agent, p, s } from "rig";

// Agent role: collect recent git commits as raw log lines.
const commitCollector = agent({
  model: "small",
  instructions: p`Run ${p.bash("git log --oneline -20 2>/dev/null || echo ''")} and return each line as a commit entry with hash and message.`,
  output: s.object({
    commits: s.array(s.object({ hash: s.string, message: s.string })),
  }),
});

// Agent role: classify each commit by conventional commit category.
const commitClassifier = agent({
  model: "small",
  input: s.object({ commits: s.array(s.object({ hash: s.string, message: s.string })) }),
  instructions: "For each commit in input.commits, classify it as feat, fix, chore, docs, or other based on the commit message prefix. Return classified commits array and a categories count record.",
  output: s.object({
    classified: s.array(s.object({
      hash: s.string,
      message: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
    categories: s.record(s.int),
  }),
});

// Agent role: format classified commits into a markdown changelog entry.
const changelogFormatter = agent({
  model: "small",
  input: s.object({
    classified: s.array(s.object({
      hash: s.string,
      message: s.string,
      category: s.enum("feat", "fix", "chore", "docs", "other"),
    })),
    categories: s.record(s.int),
  }),
  instructions: "Format input.classified into a markdown changelog entry grouped by category. Return changelogEntry (markdown string), commitCount, and categories (the input categories record).",
  output: s.object({
    changelogEntry: s.string,
    commitCount: s.int,
    categories: s.record(s.int),
  }),
});

// Agent role: orchestrate changelog generation by running collector, classifier, then formatter.
const changelogCoordinator = agent({
  model: "small",
  agents: { commitCollector, commitClassifier, changelogFormatter },
  instructions: "Step 1: call commitCollector to get recent commits. Step 2: pass the commits array to commitClassifier. Step 3: pass classified and categories to changelogFormatter. Return changelogFormatter's output.",
  output: s.object({
    changelogEntry: s.string,
    commitCount: s.int,
    categories: s.record(s.int),
  }),
});

export default changelogCoordinator;
```
