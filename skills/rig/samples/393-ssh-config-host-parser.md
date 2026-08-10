# 393 - SSH Config Host Parser

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: parse ~/.ssh/config to extract Host blocks and return a record
// of per-host connection parameters.
const sshConfigHostParser = agent({
  model: "small",
  instructions: p`Parse the SSH configuration file and extract all Host blocks.
SSH config: ${p.readOptional("~/.ssh/config", "# empty")}
Call parseHostBlock for each Host entry found in the file.
Return a record keyed by the host pattern.`,
  tools: [
    defineTool("parseHostBlock", {
      description: "Parse a single SSH Host block text and extract connection fields",
      parameters: s.object({ hostPattern: s.string, blockText: s.string }),
      handler({ hostPattern, blockText }) {
        const get = (key: string) => blockText.match(new RegExp(`^\\s*${key}\\s+(.+)`, "im"))?.[1]?.trim();
        const portStr = get("Port");
        return {
          hostPattern,
          hostName: get("HostName") ?? hostPattern,
          user: get("User") ?? null,
          port: portStr ? parseInt(portStr, 10) : null,
          identityFile: get("IdentityFile") ?? null,
        };
      },
    }),
  ],
  output: s.record(
    s.object({
      hostName: s.string,
      user: s.optional(s.string),
      port: s.optional(s.int),
      identityFile: s.optional(s.string),
    }),
  ),
  addons: [repair()],
});

export default sshConfigHostParser;
```
