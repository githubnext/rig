# 440 - Markdown Frontmatter Extractor

```rig
import { agent, p, s, defineTool, steering, repair } from "rig";

const extractFrontmatter = defineTool("extractFrontmatter", {
  description: "Extract YAML frontmatter fields from markdown content.",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { hasFrontmatter: false, rawFields: {} };
    const raw: Record<string, string> = {};
    for (const line of match[1].split("\n")) {
      const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (kv) raw[kv[1]] = kv[2].trim();
    }
    return { hasFrontmatter: true, rawFields: raw };
  },
});

// Agent role: Extract and parse YAML frontmatter fields from a markdown file.
const markdownFrontmatterExtractor = agent({
  model: "small",
  input: s.object({ markdownFile: s.path }),
  instructions: p`Read the markdown file: ${p.readInput("markdownFile")}. Use extractFrontmatter to parse any YAML frontmatter block. Return structured fields.`,
  output: s.object({
    title: s.optional(s.string),
    date: s.optional(s.string),
    tags: s.optional(s.array(s.string)),
    hasFrontmatter: s.boolean,
    rawFields: s.record(s.string),
  }),
  tools: [extractFrontmatter],
  addons: [steering(), repair()],
});

export default markdownFrontmatterExtractor;
```
