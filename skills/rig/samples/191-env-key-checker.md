# 191 - Env Key Checker

```rig
import { agent, p, s, defineTool } from "rig";

const extractKeys = defineTool("extractKeys", {
  description: "Extract KEY names from dotenv-style file content",
  parameters: s.object({ content: s.string }),
  handler({ content }) {
    const keys = (content.match(/^([A-Z_][A-Z0-9_]*)=/gm) ?? []).map((l: string) => l.replace("=", ""));
    return { keys };
  },
});

// Agent role: compare .env.example required keys against .env actual keys to find missing and extra entries.
const envKeyChecker = agent({
  model: "small",
  instructions: p`Read required keys from ${p.readOptional(".env.example")} and present keys from ${p.readOptional(".env")}. Use extractKeys on each content. Compare to find missing (in example, not in env) and extra (in env, not in example) keys.`,
  output: s.object({
    missing: s.array(s.string),
    extra: s.array(s.string),
    status: s.enum("complete", "partial", "empty"),
  }),
  tools: [extractKeys],
});

export default envKeyChecker;
```
