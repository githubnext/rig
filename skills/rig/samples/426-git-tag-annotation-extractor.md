# 426 - Git Tag Annotation Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { execSync } from "node:child_process";

const classifyTagType = defineTool("classifyTagType", {
  description: "Classify a git tag as annotated, lightweight, or signed.",
  parameters: s.object({ tagName: s.string }),
  handler({ tagName }: { tagName: string }) {
    try {
      const objType = execSync(`git cat-file -t "refs/tags/${tagName}" 2>/dev/null || echo lightweight`, { encoding: "utf-8" }).trim();
      if (objType === "tag") {
        const body = execSync(`git cat-file tag "refs/tags/${tagName}" 2>/dev/null || echo ""`, { encoding: "utf-8" });
        if (/BEGIN PGP/.test(body)) return { type: "signed" as const, subject: "", date: "" };
        const subjectMatch = body.match(/^subject (.+)$/m);
        const dateMatch = body.match(/^tagger .+ (\d{4}-\d{2}-\d{2})/m);
        return {
          type: "annotated" as const,
          subject: subjectMatch ? subjectMatch[1] : "",
          date: dateMatch ? dateMatch[1] : "",
        };
      }
      return { type: "lightweight" as const, subject: "", date: "" };
    } catch {
      return { type: "lightweight" as const, subject: "", date: "" };
    }
  },
});

// Agent role: extract and classify all git tag annotations in the repository.
const gitTagAnnotationExtractor = agent({
  model: "small",
  instructions: p`Extract and classify git tag annotations.

All tags in repository:
${p.bash("git tag -l | head -50")}

For each tag name, call classifyTagType to determine type, subject, and date.
Build tags record keyed by tag name.
Count annotatedCount, lightweightCount, totalTags.`,
  output: s.object({
    tags: s.record(s.object({
      type: s.enum("annotated", "lightweight", "signed"),
      subject: s.optional(s.string),
      date: s.optional(s.string),
    })),
    annotatedCount: s.int,
    lightweightCount: s.int,
    totalTags: s.int,
  }),
  tools: [classifyTagType],
  addons: [repair()],
});

export default gitTagAnnotationExtractor;
```
