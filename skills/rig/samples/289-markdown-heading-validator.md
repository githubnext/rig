# 289 - Markdown Heading Validator

```rig
import { agent, defineTool, p, s, repair } from "rig";

const validateHeadings = defineTool("validateHeadings", {
  description: "Parse heading structure from markdown content and validate level ordering.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    const { readFile } = await import("node:fs/promises");
    try {
      const content = await readFile(filePath, "utf8");
      const headings: Array<{ level: number; text: string }> = [];
      for (const m of content.matchAll(/^(#{1,6})\s+(.+)/gm)) {
        headings.push({ level: (m[1] as string).length, text: (m[2] as string).trim() });
      }
      const issues: string[] = [];
      const h1Count = headings.filter((h: { level: number }) => h.level === 1).length;
      if (h1Count > 1) issues.push(`Multiple H1 headings found (${h1Count})`);
      if (h1Count === 0 && headings.length > 0) issues.push("No H1 heading found");
      for (let i = 1; i < headings.length; i++) {
        if (headings[i].level - headings[i - 1].level > 1) {
          issues.push(`Skipped heading level at "${headings[i].text}" (level ${headings[i].level} after level ${headings[i - 1].level})`);
        }
      }
      const maxDepth = headings.reduce((max: number, h: { level: number }) => Math.max(max, h.level), 0);
      return { headings, maxDepth, isValid: issues.length === 0, issues };
    } catch {
      return { headings: [], maxDepth: 0, isValid: false, issues: ["Could not read file"] };
    }
  },
});

// Agent role: validate the heading structure of all markdown files in the workspace.
const markdownHeadingValidator = agent({
  model: "small",
  addons: repair(),
  instructions: p`Validate the heading structure of all markdown files in the workspace.

Markdown files:
${p.glob("**/*.md")}

For each file path above, call validateHeadings to check its heading structure. Return a record keyed by file path with headings array, maxDepth, isValid, and any issues found.`,
  tools: [validateHeadings],
  output: s.record(
    s.object({
      headings: s.array(s.object({ level: s.int, text: s.string })),
      maxDepth: s.int,
      isValid: s.boolean,
      issues: s.array(s.string),
    })
  ),
});

export default markdownHeadingValidator;
```
