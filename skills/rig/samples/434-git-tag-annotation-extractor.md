# 434 - Git Tag Annotation Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyTagKind = defineTool("classifyTagKind", {
  description: "Classify a git tag as release, pre-release, milestone, or other based on its name.",
  parameters: s.object({ tagName: s.string, subject: s.string }),
  handler({ tagName, subject }: { tagName: string; subject: string }) {
    const name = tagName.toLowerCase();
    if (/-(alpha|beta|rc|preview|pre|next|canary)\b/.test(name)) {
      return { kind: "pre-release" as const };
    }
    if (/^v?\d+\.\d+(\.\d+)?$/.test(name)) {
      return { kind: "release" as const };
    }
    if (/milestone|sprint|phase/.test(name) || /milestone|sprint|phase/.test(subject.toLowerCase())) {
      return { kind: "milestone" as const };
    }
    return { kind: "other" as const };
  },
});

// Agent role: extract and classify git tag annotations in the repository.
const gitTagAnnotationExtractor = agent({
  model: "small",
  instructions: p`Extract and classify git tag annotations.

Tag listing with subject and date:
${p.bash("git tag -l --format='%(refname:short)|%(subject)|%(taggerdate:short)' 2>/dev/null | head -50")}

For each line (format: name|subject|date), call classifyTagKind with tagName and subject.
Build a tags array with name, subject, date (omit if empty), and kind.
Count totalTags (total lines processed), releaseTags (kind === "release").`,
  tools: [classifyTagKind],
  output: s.object({
    tags: s.array(
      s.object({
        name: s.string,
        subject: s.string,
        date: s.optional(s.string),
        kind: s.enum("release", "pre-release", "milestone", "other"),
      })
    ),
    totalTags: s.int,
    releaseTags: s.int,
  }),
  addons: [repair()],
});

export default gitTagAnnotationExtractor;
```
