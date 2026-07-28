# 252 - Markdown Link Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const checkUrl = defineTool("checkUrl", {
  description: "Check the HTTP status of a URL using curl",
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

// Agent role: locate markdown files, extract HTTP links, and check each link's HTTP status
const markdownLinkChecker = agent({
  name: "markdownLinkChecker",
  model: "small",
  addons: repair(),
  tools: [checkUrl],
  instructions: p`Check HTTP links found across all markdown files in this workspace.

Markdown files found:
${p.bash("find . -name '*.md' -not -path '*/node_modules/*' | head -20")}

Unique URLs extracted:
${p.bash("grep -roh 'https\\?://[^)\"\\s]*' . --include='*.md' 2>/dev/null | sort -u | head -50")}

For each URL, call checkUrl and classify the result:
- ok: HTTP 200-299
- redirect: HTTP 301, 302, 307, 308
- broken: HTTP 400-599
- timeout: curl timed out or failed
- skipped: malformed or non-http URL

Set allValid to true only if brokenCount is 0.`,
  output: s.object({
    links: s.array(
      s.object({
        url: s.url,
        status: s.enum("ok", "broken", "redirect", "timeout", "skipped"),
        httpCode: s.optional(s.int),
        foundInFile: s.optional(s.path),
      })
    ),
    brokenCount: s.int,
    allValid: s.boolean,
  }),
});

export default markdownLinkChecker;
```
