# 473 - Git Tag Message Extractor

```rig
import { agent, defineTool, p, repair, s } from "rig";

const fetchTagMessage = defineTool("fetchTagMessage", {
  description: "Fetch the annotation message for a git tag. Returns empty string if lightweight.",
  parameters: s.object({ tagName: s.string }),
  handler: async ({ tagName }) => {
    const { execSync } = await import("node:child_process");
    try {
      const output = execSync(`git cat-file tag ${tagName} 2>/dev/null`, { encoding: "utf8" });
      const lines = output.split("\n");
      const msgStart = lines.findIndex((line: string) => line === "") + 1;
      const message = msgStart > 0 ? lines.slice(msgStart).join("\n").trim() : "";
      return { isAnnotated: true, message };
    } catch {
      return { isAnnotated: false, message: "" };
    }
  },
});

// Agent role: list all git tags and extract their annotation messages.
const gitTagMessageExtractor = agent({
  model: "small",
  instructions: p`Get the list of tags from ${p.bash("git tag -l 2>/dev/null || echo ''")}. For each tag, call fetchTagMessage to determine if it is annotated and get its message. Return tags as an array with name, optional message, and isAnnotated. Include totalTags and annotatedCount.`,
  output: s.object({
    tags: s.array(s.object({
      name: s.string,
      message: s.optional(s.string),
      isAnnotated: s.boolean,
    })),
    totalTags: s.int,
    annotatedCount: s.int,
  }),
  tools: [fetchTagMessage],
  maxTurns: 6,
  addons: repair(),
});

export default gitTagMessageExtractor;
```
