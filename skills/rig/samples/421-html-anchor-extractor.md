# 421 - Html Anchor Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractAnchors = defineTool("extractAnchors", {
  description: "Extract all anchor href values from an HTML file and classify each link.",
  parameters: s.object({ filePath: s.path }),
  async handler({ filePath }: { filePath: string }) {
    try {
      const content = await readFile(filePath, "utf-8");
      const re = /href=["']([^"']+)["']/gi;
      const results: Array<{ url: string; type: "internal" | "external" | "fragment"; file: string }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const url = m[1];
        let type: "internal" | "external" | "fragment" = "internal";
        if (url.startsWith("#")) type = "fragment";
        else if (/^https?:\/\//.test(url) || url.startsWith("//")) type = "external";
        results.push({ url, type, file: filePath });
      }
      return results;
    } catch {
      return [];
    }
  },
});

// Agent role: extract and classify all anchor links from HTML files in the workspace.
const htmlAnchorExtractor = agent({
  model: "small",
  instructions: p`Extract and classify all anchor href links from HTML files.

HTML files in workspace:
${p.bash("find . -name '*.html' -not -path '*/node_modules/*' | head -30")}

Steps:
1. For each file path, call extractAnchors to get links array.
2. Combine all links into a single links array.
3. totalLinks = links.length.
4. externalCount = links where type === "external".
5. internalCount = links where type === "internal".
6. fragmentCount = links where type === "fragment".`,
  output: s.object({
    links: s.array(s.object({
      url: s.string,
      type: s.enum("internal", "external", "fragment"),
      file: s.string,
    })),
    totalLinks: s.int,
    externalCount: s.int,
    internalCount: s.int,
    fragmentCount: s.int,
  }),
  tools: [extractAnchors],
  addons: [repair()],
});

export default htmlAnchorExtractor;
```
