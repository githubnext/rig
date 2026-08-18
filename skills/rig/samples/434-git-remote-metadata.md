# git-remote-metadata - Git Remote Metadata Inspector

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyRemote = defineTool("classifyRemote", {
  description: "Classify a git remote URL by hosting provider.",
  parameters: s.object({
    name: s.string,
    url: s.string,
  }),
  handler: async ({ url }) => {
    if (/github\.com/i.test(url)) return { type: "github" as const };
    if (/gitlab\.com/i.test(url)) return { type: "gitlab" as const };
    if (/bitbucket\.org/i.test(url)) return { type: "bitbucket" as const };
    return { type: "other" as const };
  },
});

// Agent role: inspect git remotes and report their URLs, types, and branch counts.
const gitRemoteMetadataInspector = agent({
  model: "small",
  output: s.record(s.object({
    url: s.string,
    type: s.enum("github", "gitlab", "bitbucket", "other"),
    branchCount: s.int,
  })),
  instructions: p`List git remotes with ${p.bash("git remote -v")} then for each unique remote call classifyRemote with its name and fetch URL. Count remote branches with ${p.bash("git ls-remote --heads --quiet 2>/dev/null | wc -l")}. Return a record keyed by remote name containing url, type, and branchCount.`,
  tools: [classifyRemote],
  addons: [steering()],
  maxTurns: 3,
});

export default gitRemoteMetadataInspector;
```
