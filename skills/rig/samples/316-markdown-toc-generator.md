# 316 - Markdown Toc Generator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

// Agent role: generate a table of contents markdown file from all headings found in workspace .md files.
const markdownTocGenerator = agent({
  model: "small",
  instructions: p`You are a markdown table of contents generator.

Find all markdown files in the workspace:
${p.glob("**/*.md")}

For each file, call extractHeadings to parse its heading structure.
Then write the combined TOC to ${p.write("TOC.md", "tocContent")}.
Return the declared output.`,
  tools: [
    defineTool("extractHeadings", {
      description: "Read a markdown file and extract all headings with their levels and anchor text",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const content = await readFile(filePath, "utf8");
        const headings: Array<{ level: number; text: string; anchor: string }> = [];
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        for (const match of content.matchAll(headingRegex)) {
          const level = match[1].length;
          const text = match[2].trim();
          const anchor = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
          headings.push({ level, text, anchor });
        }
        return { filePath, headings };
      },
    }),
  ],
  output: s.object({
    processedFiles: s.array(s.path),
    headingCount: s.int,
    outputPath: s.path,
    tocGenerated: s.boolean,
  }),
  addons: [repair()],
});

export default markdownTocGenerator;
```
