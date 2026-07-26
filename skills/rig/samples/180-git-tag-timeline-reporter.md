# 180 - Git Tag Timeline Reporter

```rig
import { agent, p, s } from "rig";

// Agent role: summarize release details for a single git tag range.
const timelineSummarizer = agent({
  name: "timelineSummarizer",
  model: "nano",
  input: s.object({ fromTag: s.string, toTag: s.string, logOutput: s.string }),
  instructions: p`Given the git log output between two tags, extract the commit count and top 3 authors.`,
  output: s.object({
    commitCount: s.int,
    topAuthors: s.array(s.string),
  }),
});

// Agent role: build a release timeline from git tags and report whether unreleased commits exist.
const gitTagTimelineReporter = agent({
  model: "small",
  instructions: p`List all git tags sorted by date: ${p.bash("git tag --sort=creatordate 2>/dev/null || echo ''")}. For each consecutive pair of tags, examine the log: ${p.bash("git log --oneline --format='%an' $(git tag --sort=creatordate | head -2 | tail -1)..HEAD 2>/dev/null | head -20 || echo ''")}. Delegate each tag range to the timelineSummarizer subagent. Also check for unreleased commits since the latest tag using ${p.bash("git log $(git describe --tags --abbrev=0 2>/dev/null || echo '')..HEAD --oneline 2>/dev/null | wc -l || echo 0")}. Build the full timeline and return structured results.`,
  output: s.object({
    timeline: s.array(s.object({
      tag: s.string,
      date: s.string,
      commitCount: s.int,
      topAuthors: s.array(s.string),
    })),
    hasUnreleasedCommits: s.boolean,
  }),
  agents: { timelineSummarizer },
});

export default gitTagTimelineReporter;
```
