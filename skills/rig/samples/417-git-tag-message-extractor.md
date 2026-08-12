# 417 - Git Tag Message Extractor

```rig
import { agent, p, s, repair, defineTool } from "rig";

const fetchTagMessage = defineTool("fetchTagMessage", {
  description: "Fetch the message of a git tag, detecting if it is annotated.",
  parameters: s.object({ tagName: s.string }),
  handler: ({ tagName }: { tagName: string }) => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    try {
      const raw = execSync(`git cat-file tag "${tagName}" 2>/dev/null`, { encoding: "utf8" });
      const msgStart = raw.indexOf("\n\n");
      const message = msgStart >= 0 ? raw.slice(msgStart + 2).trim() : "";
      return { isAnnotated: true, message: message || null };
    } catch {
      return { isAnnotated: false, message: null };
    }
  },
});

// Agent role: List git tags and fetch messages for annotated tags, building a structured report.
const gitTagMessageExtractor = agent({
  model: "small",
  instructions: p`Git tags:
${p.bash("git tag -l 2>/dev/null | head -20")}

For each tag name listed above, call the fetchTagMessage tool to determine if it is annotated and retrieve its message. Return tags array with name, message (optional), and isAnnotated. Return totalTags and annotatedCount.`,
  tools: [fetchTagMessage],
  maxTurns: 6,
  output: s.object({
    tags: s.array(s.object({
      name: s.string,
      message: s.optional(s.string),
      isAnnotated: s.boolean,
    })),
    totalTags: s.int,
    annotatedCount: s.int,
  }),
  addons: [repair()],
});

export default gitTagMessageExtractor;

```
