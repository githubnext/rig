# 428 - Markdown Link Classifier

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractLinks = defineTool("extractLinks", {
  description: "Extract and classify all markdown links from a file.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    try {
      const content = await readFile(filePath, "utf-8");
      const re = /\[([^\]]*)\]\(([^)]+)\)/g;
      let linkCount = 0;
      let absoluteCount = 0;
      let relativeCount = 0;
      let anchorCount = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const url = m[2];
        linkCount++;
        if (url.startsWith("#")) anchorCount++;
        else if (/^https?:\/\//.test(url) || url.startsWith("mailto:")) absoluteCount++;
        else relativeCount++;
      }
      return { linkCount, absoluteCount, relativeCount, anchorCount };
    } catch {
      return { linkCount: 0, absoluteCount: 0, relativeCount: 0, anchorCount: 0 };
    }
  },
});

// Agent role: find and classify all links in markdown files across the workspace.
const markdownLinkClassifier = agent({
  model: "small",
  instructions: p`Extract and classify all markdown links across .md files.

Markdown files in workspace:
${p.glob("**/*.md")}

For each file path, call extractLinks to get per-file link counts.
Build files record keyed by file path.
totalLinks = sum of all linkCount.
absoluteLinksCount = sum of all absoluteCount.`,
  output: s.object({
    files: s.record(s.object({
      linkCount: s.int,
      absoluteCount: s.int,
      relativeCount: s.int,
      anchorCount: s.int,
    })),
    totalLinks: s.int,
    absoluteLinksCount: s.int,
  }),
  tools: [extractLinks],
  addons: [repair()],
});

export default markdownLinkClassifier;
```
