# 129 - Markdown Link Checker

```rig
import { agent, p, s, defineTool } from "rig";

const checkUrl = defineTool("checkUrl", {
  description: "Check HTTP status of a URL using curl",
  parameters: s.object({ url: s.string }),
  handler: async ({ url }) => {
    const { execSync } = await import("node:child_process");
    try {
      const code = execSync(
        `curl --head --silent --max-time 5 -o /dev/null -w "%{http_code}" "${url}" 2>/dev/null`,
        { encoding: "utf8", timeout: 8000 }
      ).trim();
      return code;
    } catch {
      return "timeout";
    }
  },
});

// Agent role: check HTTP status of links found in markdown files
const markdownLinkChecker = agent({
  name: "markdownLinkChecker",
  model: "small",
  instructions: p`Find and check HTTP links in markdown files.

Markdown files: ${p.bash("find . -name '*.md' -not -path '*/node_modules/*' | head -20")}

URLs found: ${p.bash("grep -roh 'https\\?://[^)\"\\s]*' . --include='*.md' 2>/dev/null | sort -u | head -50")}

For each unique URL, use the checkUrl tool to get the HTTP status code.
Classify status:
- ok: 200–299
- redirect: 301, 302, 307, 308
- broken: 400–599
- timeout: curl timed out
- skipped: non-http or malformed URL

Set allValid to true only if no links are broken.
Include foundInFile for each link if determinable.`,
  output: s.object({
    links: s.array(
      s.object({
        url: s.url,
        status: s.enum("ok", "broken", "redirect", "timeout", "skipped"),
        httpCode: s.optional(s.int),
        foundInFile: s.optional(s.path),
      })
    ),
    totalChecked: s.int,
    brokenCount: s.int,
    allValid: s.boolean,
  }),
  tools: [checkUrl],
});

export default markdownLinkChecker;
```
