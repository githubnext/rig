# 367 - HTML Anchor Link Extractor

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractAnchors = defineTool("extractAnchors", {
  description: "Extract all anchor href values from an HTML file and classify each as internal, external, or fragment.",
  parameters: { filePath: s.path },
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const content = await readFile(filePath, "utf-8");
      const re = /href=["']([^"']+)["']/gi;
      const results: Array<{ href: string; type: "internal" | "external" | "fragment" }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        const href = m[1];
        let type: "internal" | "external" | "fragment" = "internal";
        if (href.startsWith("#")) type = "fragment";
        else if (/^https?:\/\//.test(href) || href.startsWith("//")) type = "external";
        results.push({ href, type });
      }
      return results;
    } catch {
      return [];
    }
  },
});

const htmlAnchorLinkExtractor = agent({
  model: "small",
  instructions: p`Extract and classify all anchor links from HTML files.

HTML files found:
${p.bash("find . -name '*.html' -not -path '*/node_modules/*' | head -30")}

Steps:
1. For each HTML file path, call extractAnchors to get the list of hrefs with their types.
2. Flatten all results into a links array, adding sourceFile to each entry.
3. totalLinks = total count.
4. externalCount = links with type "external".
5. internalCount = links with type "internal".
6. fragmentCount = links with type "fragment".`,
  output: s.object({
    links: s.array(
      s.object({
        href: s.string,
        type: s.enum("internal", "external", "fragment"),
        sourceFile: s.string,
      })
    ),
    totalLinks: s.number,
    externalCount: s.number,
    internalCount: s.number,
    fragmentCount: s.number,
  }),
  tools: [extractAnchors],
  addons: [repair()],
});

export default htmlAnchorLinkExtractor;
```
