# 139 - Markdown Frontmatter Checker

```rig
import { agent, p, s, defineTool } from "rig";
import { readFileSync, existsSync } from "node:fs";

const parseFrontmatter = defineTool("parseFrontmatter", {
  description: "Parse YAML frontmatter from a markdown file and check for required fields",
  parameters: s.object({ filePath: s.string }),
  handler: ({ filePath }) => {
    if (!existsSync(filePath)) return JSON.stringify({ error: "file not found" });
    const content = readFileSync(filePath, "utf8");
    if (!content.startsWith("---")) return JSON.stringify({ presentFields: [], missingFields: ["title", "description", "date"], status: "missing" });
    const end = content.indexOf("---", 3);
    if (end === -1) return JSON.stringify({ presentFields: [], missingFields: ["title", "description", "date"], status: "missing" });
    const fm = content.slice(3, end);
    const required = ["title", "description", "date"];
    const present = required.filter((f) => new RegExp(`^${f}\\s*:`, "m").test(fm));
    const missing = required.filter((f) => !present.includes(f));
    const status = missing.length === 0 ? "complete" : present.length === 0 ? "missing" : "partial";
    return JSON.stringify({ presentFields: present, missingFields: missing, status });
  },
});

// Agent role: check markdown files for required YAML frontmatter fields (title, description, date).
const markdownFrontmatterChecker = agent({
  model: "small",
  maxTurns: 4,
  instructions: p`Check markdown files for required YAML frontmatter fields.

Markdown files: ${p.bash("find . -name '*.md' -not -path '*/node_modules/*' | head -50")}

For each markdown file, use parseFrontmatter to detect which required fields (title, description, date) are present or missing. Return a record keyed by filename.`,
  output: s.record(s.object({
    presentFields: s.array(s.string),
    missingFields: s.array(s.string),
    status: s.enum("complete", "partial", "missing"),
  })),
  tools: [parseFrontmatter],
});

export default markdownFrontmatterChecker;
```
