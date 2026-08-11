# 401 - Git File At Revision

```rig
import { agent, p, s, repair, defineTool } from "rig";

const extractRevisionMetadata = defineTool("extractRevisionMetadata", {
  description: "Get commit hash, message, and file content at a given git revision.",
  parameters: s.object({ revision: s.string, filePath: s.path }),
  handler: async ({ revision, filePath }: { revision: string; filePath: string }) => {
    const { execSync } = await import("node:child_process");
    const fileContent = execSync(`git show ${revision}:${filePath} 2>/dev/null || echo ""`, { encoding: "utf8" });
    const logLine = execSync(`git log --oneline -1 ${revision} -- ${filePath} 2>/dev/null || echo ""`, { encoding: "utf8" }).trim();
    const spaceIdx = logLine.indexOf(" ");
    return {
      fileContent,
      commitHash: spaceIdx > -1 ? logLine.slice(0, spaceIdx) : logLine,
      commitMessage: spaceIdx > -1 ? logLine.slice(spaceIdx + 1) : "",
      linesCount: fileContent.split("\n").length,
    };
  },
});

// Agent role: Extract file content at a specific git revision and return metadata.
const gitFileAtRevision = agent({
  model: "small",
  input: s.object({ filePath: s.path, revision: s.string }),
  instructions: p`Use the extractRevisionMetadata tool with the filePath and revision from the input to retrieve the file content and commit metadata. Return all fields exactly as provided by the tool.`,
  tools: [extractRevisionMetadata],
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
