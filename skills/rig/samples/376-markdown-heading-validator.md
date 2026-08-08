# 376 - Markdown Heading Validator

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const validateHeadings = defineTool("validateHeadings", {
  description: "Validate Markdown heading structure in a file — check for skipped levels and multiple H1s.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }) {
    const content = await readFile(filePath, "utf8");
    const headings = [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m: RegExpMatchArray) => ({
      level: m[1].length,
      text: m[2].trim(),
    }));
    const issues: string[] = [];
    const h1Count = headings.filter((h: { level: number; text: string }) => h.level === 1).length;
    if (h1Count > 1) issues.push(`Multiple H1 headings found (${h1Count})`);
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i - 1].level + 1) {
        issues.push(`Heading level skipped: H${headings[i - 1].level} → H${headings[i].level}`);
      }
    }
    const maxDepth = headings.reduce((max: number, h: { level: number; text: string }) => Math.max(max, h.level), 0);
    return { headings, maxDepth, isValid: issues.length === 0, issues };
  },
});

// Agent role: Validate the heading structure of all Markdown files in the workspace.
const markdownHeadingValidator = agent({
  model: "small",
  instructions: p`Validate Markdown heading structure for files found at ${p.glob("**/*.md")}. Use validateHeadings on each file and return results keyed by file path.`,
  output: s.record(s.object({
    headings: s.array(s.object({ level: s.int, text: s.string })),
    maxDepth: s.int,
    isValid: s.boolean,
    issues: s.array(s.string),
  })),
  tools: [validateHeadings],
  addons: [repair()],
});

export default markdownHeadingValidator;
```
