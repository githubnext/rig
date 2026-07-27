# 227 - Git Tag Date Mapper

```rig
import { agent, defineTool, p, s, steering } from "rig";

const classifyTagAge = defineTool("classifyTagAge", {
  description: "Classify a tag's age based on its ISO date string",
  parameters: s.object({ dateStr: s.string }),
  handler({ dateStr }) {
    const date = new Date(dateStr);
    const now = new Date();
    const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    let ageClass: "recent" | "stable" | "old" | "ancient";
    if (daysDiff < 30) ageClass = "recent";
    else if (daysDiff < 180) ageClass = "stable";
    else if (daysDiff < 730) ageClass = "old";
    else ageClass = "ancient";
    return { ageClass };
  },
});

// Agent role: map git tags to their commit dates and classify their age.
const gitTagDateMapper = agent({
  model: "small",
  addons: steering(),
  instructions: p`Inspect git tags and their dates.

Tags:
${p.bash("git tag -l --sort=-version:refname | head -20 2>/dev/null || echo 'no tags'")}

Tag log:
${p.bash("git log --tags --simplify-by-decoration --pretty='%D|%ai|%s' | head -30 2>/dev/null || echo 'no tag log'")}

For each tag, extract its ISO date and call classifyTagAge. Return a record keyed by tag name with date, subject, and ageClass. Include totalTags and latestTag.`,
  tools: [classifyTagAge],
  output: s.object({
    tags: s.record(s.object({
      date: s.string,
      subject: s.string,
      ageClass: s.enum("recent", "stable", "old", "ancient"),
    })),
    totalTags: s.int,
    latestTag: s.optional(s.string),
  }),
});

export default gitTagDateMapper;
```
