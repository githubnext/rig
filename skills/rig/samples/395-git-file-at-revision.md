# 395 - Git File at Revision

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: retrieve a specific file at a given git revision and return its
// content along with commit metadata.
const gitFileAtRevision = agent({
  model: "small",
  input: s.object({ filePath: s.string, revision: s.string }),
  instructions: p`Fetch the file content and commit metadata for the given revision.
File at revision: ${p.bash("git show HEAD:README.md 2>/dev/null | head -5 || echo '(use input revision and filePath)'")}
Call extractRevisionMetadata with the provided revision from input.
Return the declared output.`,
  tools: [
    defineTool("extractRevisionMetadata", {
      description: "Run git log to get commit hash and message for a revision",
      parameters: s.object({ revision: s.string }),
      handler({ revision }) {
        const { execSync } = require("node:child_process");
        try {
          const output = execSync(`git log --oneline -1 "${revision}" 2>/dev/null`, { encoding: "utf8" }).trim();
          const [commitHash, ...rest] = output.split(" ");
          return { commitHash: commitHash ?? revision, commitMessage: rest.join(" ") || "unknown" };
        } catch {
          return { commitHash: revision, commitMessage: "unknown" };
        }
      },
    }),
  ],
  output: s.object({
    fileContent: s.string,
    commitHash: s.string,
    commitMessage: s.string,
    linesCount: s.int,
    revision: s.string,
  }),
  addons: [repair()],
});

export default gitFileAtRevision;
```
