# 165 - Git Tag Timeline

```rig
import { agent, p, s } from "rig";

// Agent role: summarize commits and authors between two git tags.
const timelineSummarizer = agent({
  name: "timelineSummarizer",
  model: "nano",
  input: s.object({
    tag: s.string,
    prevTag: s.string,
    commits: s.string,
  }),
  instructions: p`Summarize the git log between two tags and return structured timeline entry.`,
  output: s.object({
    tag: s.string,
    date: s.string,
    commitCount: s.int,
    topAuthors: s.array(s.string),
  }),
});

// Agent role: build a release timeline from git tags showing commit counts and top authors per tag.
const gitTagTimeline = agent({
  model: "small",
  agents: { timelineSummarizer },
  instructions: p`Build a git tag release timeline.

Git tags (sorted by date):
${p.bash("git tag --sort=version:refname 2>/dev/null | tail -20 || echo 'No tags found'")}

Recent commit log:
${p.bash("git log --oneline --format='%h %an %ad %s' --date=short -40 2>/dev/null || echo 'No commits'")}

For each tag pair, delegate to the timelineSummarizer subagent with the relevant commit log section. Also check for unreleased commits after the latest tag. Return only the declared output.`,
  output: s.object({
    timeline: s.array(s.object({
      tag: s.string,
      date: s.string,
      commitCount: s.int,
      topAuthors: s.array(s.string),
    })),
    hasUnreleasedCommits: s.boolean,
    totalTags: s.int,
  }),
});

export default gitTagTimeline;
```
