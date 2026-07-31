# 337 - Markdown Frontmatter Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const parseFrontmatter = defineTool("parseFrontmatter", {
  description: "Parse YAML frontmatter from a markdown file",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const src = await readFile(filePath, "utf-8");
    const match = src.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return { hasFrontmatter: false, title: null, date: null, tags: null };
    const fm = match[1];
    const title = (fm.match(/^title:\s*(.+)$/m) ?? [])[1]?.trim() ?? null;
    const date = (fm.match(/^date:\s*(.+)$/m) ?? [])[1]?.trim() ?? null;
    const tagsMatch = fm.match(/^tags:\s*\[(.+)\]/m);
    const tags = tagsMatch ? tagsMatch[1].split(",").map((t: string) => t.trim().replace(/['"]/g, "")) : null;
    return { hasFrontmatter: true, title, date, tags };
  },
});

// Agent role: extract YAML frontmatter from all markdown files in the workspace.
const markdownFrontmatterExtractor = agent({
  model: "small",
  instructions: p`Markdown files: ${p.glob("**/*.md")}
Call parseFrontmatter for each file and return results keyed by file path.`,
  output: s.record(s.object({
    hasFrontmatter: s.boolean,
    title: s.optional(s.string),
    date: s.optional(s.string),
    tags: s.optional(s.array(s.string)),
  })),
  tools: [parseFrontmatter],
  addons: [repair()],
  maxTurns: 8,
});

export default markdownFrontmatterExtractor;
```
