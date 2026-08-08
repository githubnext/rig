# 378 - Git Tag Annotation Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyTagType = defineTool("classifyTagType", {
  description: "Classify a git tag as annotated, lightweight, or signed based on its metadata.",
  parameters: s.object({
    tagName: s.string,
    objectType: s.string,
    taggerDate: s.string,
    subject: s.string,
  }),
  handler({ objectType, taggerDate, subject }) {
    if (/BEGIN PGP/.test(subject)) return { type: "signed" as const };
    if (objectType === "tag" || taggerDate.length > 0) return { type: "annotated" as const };
    return { type: "lightweight" as const };
  },
});

// Agent role: extract and classify git tag annotations from the repository.
const gitTagAnnotationExtractor = agent({
  model: "small",
  instructions: p`Extract and classify git tag annotations.

Git tag listing with metadata:
${p.bash("git tag -l --format='%(refname:short)|%(objecttype)|%(contents:subject)|%(taggerdate:short)' | head -30")}

For each line in the output, split by "|" to get tagName, objectType, subject, taggerDate.
Call classifyTagType for each tag to determine if it is annotated, lightweight, or signed.
Build a tags record keyed by tag name with type, subject (optional, omit if empty), and date (optional, omit if empty).
Count annotatedCount (type === "annotated"), lightweightCount (type === "lightweight"), totalTags (all tags).`,
  tools: [classifyTagType],
  output: s.object({
    tags: s.record(
      s.object({
        type: s.enum("annotated", "lightweight", "signed"),
        subject: s.optional(s.string),
        date: s.optional(s.string),
      })
    ),
    annotatedCount: s.int,
    lightweightCount: s.int,
    totalTags: s.int,
  }),
  maxTurns: 4,
  addons: repair(),
});

export default gitTagAnnotationExtractor;

```
