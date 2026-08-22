# 449 - Git Commit Msg Linter

```rig
import { agent, workflow, p, s, defineTool } from "rig";

// Agent role: Fetch recent git commit subjects.
const commitFetcher = agent({
  model: "small",
  instructions: p`Run ${p.bash('git log --format="%H|%s" -20')} and return the commits as an array of objects with hash and subject fields, parsing each line by splitting on |.`,
  output: s.object({
    commits: s.array(s.object({
      hash: s.string,
      subject: s.string,
    })),
  }),
});

const lintCommitMessage = defineTool("lintCommitMessage", {
  description: "Lint a commit message against conventional commit format",
  parameters: s.object({ subject: s.string }),
  handler: ({ subject }: { subject: string }) => {
    const conventionalPattern = /^(feat|fix|chore|docs|style|refactor|test)(\([^)]+\))?: .+/;
    const typeMatch = subject.match(/^(feat|fix|chore|docs|style|refactor|test)/);
    const isValid = conventionalPattern.test(subject);
    const category: "feat" | "fix" | "chore" | "docs" | "style" | "refactor" | "test" | "other" | "invalid" =
      typeMatch ? typeMatch[1] as "feat" | "fix" | "chore" | "docs" | "style" | "refactor" | "test"
      : isValid ? "other"
      : "invalid";
    const issue = isValid ? undefined : "Does not match conventional commit format: type(scope): description";
    return { isValid, category, issue };
  },
});

// Agent role: Lint commit messages for conventional commit compliance.
const messageLinter = agent({
  model: "small",
  input: s.object({
    commits: s.array(s.object({ hash: s.string, subject: s.string })),
  }),
  instructions: `For each commit in the input, call lintCommitMessage with the subject.
Combine results with the original hash and subject. Compute passRate as validCount / totalCommits.`,
  output: s.object({
    results: s.array(s.object({
      hash: s.string,
      subject: s.string,
      isValid: s.boolean,
      category: s.enum("feat", "fix", "chore", "docs", "style", "refactor", "test", "other", "invalid"),
      issue: s.optional(s.string),
    })),
    passRate: s.number,
    totalCommits: s.int,
  }),
  tools: [lintCommitMessage],
});

// Workflow role: Fetch commits then lint each message for conventional format compliance.
const gitCommitMsgLinter = workflow({
  meta: { name: "git-commit-msg-linter", description: "Fetch recent git commits and lint each for conventional commit format compliance" },
  body: async ({ call }) => {
    const fetched = await call(commitFetcher, "fetch recent commits");
    const commits = fetched?.commits ?? [];
    return call(messageLinter, { commits });
  },
});

export default gitCommitMsgLinter;
```
