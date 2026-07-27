# 190 - Git Tag Timeline Reporter

```rig
import { agent, p, s } from "rig";

// Agent role: summarize a git tag release interval into structured timeline data.
const timelineSummarizer = agent({
  model: "nano",
  name: "timelineSummarizer",
  input: s.object({
    tag: s.string,
    date: s.string,
    commitLog: s.string,
  }),
  instructions: p`Summarize the commit log for release ${p.inputField("tag")} on ${p.inputField("date")}.
Commit log:
${p.inputField("commitLog")}
Return the top authors (up to 3) and the commit count.`,
  output: s.object({
    tag: s.string,
    date: s.string,
    commitCount: s.int,
    topAuthors: s.array(s.string),
  }),
});

// Agent role: report git tag release timeline with commit stats between consecutive tags.
const gitTagTimelineReporter = agent({
  model: "small",
  instructions: p`You are a git release timeline reporter.

List all git tags sorted by version:
${p.bash("git tag --sort=version:refname")}

For each consecutive pair of tags, run: git log --oneline TAG1..TAG2 --format="%h %an %s"
to find commits between them. Also check for unreleased commits after the latest tag with:
${p.bash("git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo '')..HEAD 2>/dev/null | wc -l")}

For each tag interval, delegate to the timelineSummarizer subagent with the tag name, date, and commit log.
Aggregate all results into the output array.`,
  agents: { timelineSummarizer },
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

export default gitTagTimelineReporter;
```
