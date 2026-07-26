# 171 - Git Tag Timeline

```rig
import { agent, p, s } from "rig";

// Agent role: summarize a release timeline from git tag/commit data (nano).
const timelineSummarizer = agent({
  name: "timelineSummarizer",
  model: "nano",
  instructions: p`Given raw git tag data in the input, produce a structured timeline. For each tag entry extract tag name, date, commit count, and top authors.`,
  input: s.object({ rawData: s.string }),
  output: s.object({
    timeline: s.array(s.object({
      tag: s.string,
      date: s.string,
      commitCount: s.int,
      topAuthors: s.array(s.string),
    })),
    hasUnreleasedCommits: s.boolean,
  }),
});

// Agent role: gather git tag and commit metadata then delegate timeline summarization.
const gitTagTimeline = agent({
  model: "small",
  agents: { timelineSummarizer },
  instructions: p`List tags with ${p.bash("git tag --sort=-version:refname 2>/dev/null || true")} and recent commits with ${p.bash("git log --oneline -30 --format='%H %ad %an %s' --date=short 2>/dev/null || true")}. Also check for unreleased commits with ${p.bash("git log $(git describe --tags --abbrev=0 2>/dev/null || echo '')..HEAD --oneline 2>/dev/null || true")}. Pass all raw data to the timelineSummarizer subagent and return its output directly.`,
  output: s.object({
    timeline: s.array(s.object({
      tag: s.string,
      date: s.string,
      commitCount: s.int,
      topAuthors: s.array(s.string),
    })),
    hasUnreleasedCommits: s.boolean,
  }),
});

export default gitTagTimeline;
```
