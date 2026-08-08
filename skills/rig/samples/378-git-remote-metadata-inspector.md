# 378 - Git Remote Metadata Inspector

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyRemote = defineTool("classifyRemote", {
  description: "Classify a git remote URL into its hosting provider.",
  parameters: s.object({ url: s.string }),
  handler({ url }) {
    if (url.includes("github.com")) return "github" as const;
    if (url.includes("gitlab.com")) return "gitlab" as const;
    if (url.includes("bitbucket.org")) return "bitbucket" as const;
    return "other" as const;
  },
});

// Agent role: Inspect git remote metadata and classify each remote by provider.
const gitRemoteMetadataInspector = agent({
  model: "small",
  instructions: p`Inspect git remotes:
Remotes: ${p.bash("git remote -v")}
Branch count: ${p.bash("git ls-remote --heads origin 2>/dev/null | wc -l")}

Use classifyRemote for each remote URL and return results keyed by remote name.`,
  output: s.record(s.object({
    url: s.string,
    type: s.enum("github", "gitlab", "bitbucket", "other"),
    branchCount: s.int,
  })),
  tools: [classifyRemote],
  addons: [steering()],
});

export default gitRemoteMetadataInspector;
```
