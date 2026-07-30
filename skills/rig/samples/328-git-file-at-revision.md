# 328 - Git File at Revision

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: retrieve the content of a file at a specific git revision and return metadata about the commit.
const gitFileAtRevision = agent({
  model: "small",
  input: s.object({ filePath: s.path, revision: s.string }),
  instructions: p`Retrieve the file content at the given git revision.
File content: ${p.bash("git show HEAD:README.md 2>/dev/null | head -3 || echo 'example'")}
Use the extractRevisionMetadata tool on the commit log line.
Return the file content, commit metadata, and line count.`,
  output: s.object({
    fileContent: s.string,
    commitHash: s.string,
    commitMessage: s.string,
    linesCount: s.int,
    revision: s.string,
  }),
  tools: [
    defineTool("extractRevisionMetadata", {
      description: "Parse a git log --oneline line to extract commit hash and message",
      parameters: s.object({ logLine: s.string }),
      handler({ logLine }) {
        const match = logLine.match(/^([0-9a-f]{6,40})\s+(.+)$/);
        if (!match) return { commitHash: "unknown", commitMessage: logLine };
        return { commitHash: match[1], commitMessage: match[2] };
      },
    }),
  ],
  addons: [repair()],
});

export default gitFileAtRevision;
```
