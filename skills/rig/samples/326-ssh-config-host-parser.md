# 326 - SSH Config Host Parser

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: parse the SSH config file and return a record of host blocks with their connection settings.
const sshConfigHostParser = agent({
  model: "small",
  instructions: p`Parse the SSH config file and extract all Host blocks.
SSH config: ${p.readOptional("~/.ssh/config", "# no ssh config found")}
Use the parseHostBlock tool on the config content. Return a record keyed by host pattern.`,
  output: s.record(s.object({
    hostName: s.optional(s.string),
    user: s.optional(s.string),
    port: s.optional(s.int),
    identityFile: s.optional(s.path),
  })),
  tools: [
    defineTool("parseHostBlock", {
      description: "Parse SSH config content and extract Host blocks with their settings",
      parameters: s.object({ configContent: s.string }),
      handler({ configContent }) {
        const result: Record<string, { hostName?: string; user?: string; port?: number; identityFile?: string }> = {};
        const blocks = configContent.split(/^(?=Host\s)/m);
        for (const block of blocks) {
          const hostMatch = block.match(/^Host\s+(.+)/);
          if (!hostMatch) continue;
          const hostPattern = hostMatch[1].trim();
          const entry: { hostName?: string; user?: string; port?: number; identityFile?: string } = {};
          const hostnameMatch = block.match(/^\s*HostName\s+(.+)/m);
          if (hostnameMatch) entry.hostName = hostnameMatch[1].trim();
          const userMatch = block.match(/^\s*User\s+(.+)/m);
          if (userMatch) entry.user = userMatch[1].trim();
          const portMatch = block.match(/^\s*Port\s+(\d+)/m);
          if (portMatch) entry.port = parseInt(portMatch[1], 10);
          const idMatch = block.match(/^\s*IdentityFile\s+(.+)/m);
          if (idMatch) entry.identityFile = idMatch[1].trim();
          result[hostPattern] = entry;
        }
        return result;
      },
    }),
  ],
  addons: [repair()],
});

export default sshConfigHostParser;
```
