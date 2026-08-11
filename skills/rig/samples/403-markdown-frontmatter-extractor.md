# 403 - Markdown Frontmatter Extractor

```rig
import { agent, p, s, repair, defineTool } from "rig";

const parseFrontmatter = defineTool("parseFrontmatter", {
  description: "Parse YAML-style frontmatter from a markdown file path.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return { hasFrontmatter: false, title: undefined, date: undefined, tags: undefined };
    }
    const fm = match[1];
    const titleMatch = fm.match(/^title:\s*(.+)$/m);
    const dateMatch = fm.match(/^date:\s*(.+)$/m);
    const tagsMatch = fm.match(/^tags:\s*\[([^\]]*)\]/m) ?? fm.match(/^tags:\s*\n((?:  - .+\n?)*)/m);
    let tags: string[] | undefined;
    if (tagsMatch) {
      tags = tagsMatch[1].split(/[\n,]/).map((t: string) => t.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
    }
    return {
      hasFrontmatter: true,
      title: titleMatch ? titleMatch[1].trim() : undefined,
      date: dateMatch ? dateMatch[1].trim() : undefined,
      tags,
    };
  },
});

// Agent role: Extract YAML frontmatter metadata from all markdown files in the workspace.
const markdownFrontmatterExtractor = agent({
  model: "small",
  instructions: p`Markdown files found:
${p.glob("**/*.md")}

For each markdown file path listed above, call the parseFrontmatter tool with that file path. Return a record keyed by file path with the frontmatter fields.`,
  tools: [parseFrontmatter],
  output: s.record(
    s.object({
      title: s.optional(s.string),
      date: s.optional(s.string),
      tags: s.optional(s.array(s.string)),
      hasFrontmatter: s.boolean,
    })
  ),
  addons: [repair()],
});

export default markdownFrontmatterExtractor;
```
