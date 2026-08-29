# 487 - Git Tag Message Extractor

```rig
import { agent, defineTool, p, s, steering } from "rig";

const getTagDetails = defineTool("getTagDetails", {
  description: "Get details of a git tag including type (annotated or lightweight), message, and tagger.",
  parameters: s.object({ tag: s.string }),
  handler: async ({ tag }) => {
    const { execSync } = await import("node:child_process");
    let tagType: "annotated" | "lightweight" = "lightweight";
    let message: string | undefined;
    let tagger: string | undefined;
    try {
      const output = execSync(`git cat-file -t "${tag}" 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (output === "tag") {
        tagType = "annotated";
        const tagObj = execSync(`git cat-file tag "${tag}" 2>/dev/null`, { encoding: "utf-8" });
        const taggerLine = tagObj.split("\n").find((l: string) => l.startsWith("tagger "));
        if (taggerLine) tagger = taggerLine.replace(/^tagger\s+/, "").trim();
        const msgStart = tagObj.indexOf("\n\n");
        if (msgStart !== -1) message = tagObj.slice(msgStart + 2).trim();
      }
    } catch {
      // lightweight tag
    }
    return { tagType, message, tagger };
  },
});

// Agent role: extract and classify all git tag messages and metadata.
const gitTagMessageExtractor = agent({
  model: "small",
  instructions: p`List all git tags: ${p.bash("git tag -l 2>/dev/null || echo ''")}. For each tag name, call getTagDetails. Return tags as a record keyed by tag name with tagType, message (omit if lightweight), and tagger (omit if not annotated). Include totalTags, annotatedCount, lightweightCount, and mostRecentTag (last tag alphabetically or by creation, omit if no tags).`,
  output: s.object({
    tags: s.record(s.object({
      tagType: s.enum("annotated", "lightweight"),
      message: s.optional(s.string),
      tagger: s.optional(s.string),
    })),
    totalTags: s.int,
    annotatedCount: s.int,
    lightweightCount: s.int,
    mostRecentTag: s.optional(s.string),
  }),
  tools: [getTagDetails],
  maxTurns: 8,
  addons: [steering()],
});

export default gitTagMessageExtractor;
```
