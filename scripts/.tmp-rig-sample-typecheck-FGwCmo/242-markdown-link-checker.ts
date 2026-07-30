import { agent, p, s, defineTool } from "rig";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const checkUrl = defineTool("checkUrl", {
  description: "Check an HTTP URL with curl and return its status.",
  parameters: { url: s.string },
  handler: async ({ url }: { url: string }) => {
    try {
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" --max-time 5 --location "${url}"`,
      );
      const code = parseInt(stdout.trim(), 10);
      let status: string;
      if (code >= 200 && code < 300) status = "ok";
      else if (code >= 300 && code < 400) status = "redirect";
      else if (code === 0) status = "timeout";
      else status = "broken";
      return { httpCode: code, status };
    } catch {
      return { httpCode: 0, status: "timeout" };
    }
  },
});

// Agent role: check all HTTP/HTTPS links found in markdown files in the workspace.
const markdownLinkChecker = agent({
  model: "typecheck",
  instructions: p`Check all HTTP/HTTPS links found in markdown files.

Markdown files: ${p.bash("find . -name '*.md' -not -path '*/node_modules/*' | head -30")}
Extracted URLs: ${p.bash("grep -rh 'https\\?://[^ )>\"]*' --include='*.md' --no-filename . 2>/dev/null | grep -oE 'https?://[^ )>\"]+' | sort -u | head -50")}

Steps:
1. For each unique URL extracted, call checkUrl.
2. Build the links array with url, status, httpCode, and foundInFile (leave as null if not determinable).
3. Count brokenCount (status = "broken" or "timeout").
4. Set allValid to true only if brokenCount is 0.`,
  output: s.object({
    links: s.array(s.object({
      url: s.string,
      status: s.enum("ok", "broken", "redirect", "timeout", "skipped"),
      httpCode: s.optional(s.number),
      foundInFile: s.optional(s.string),
    })),
    brokenCount: s.number,
    allValid: s.boolean,
  }),
  tools: [checkUrl],
  maxTurns: 8,
});

export default markdownLinkChecker;
