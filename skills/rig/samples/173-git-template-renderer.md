# 173 - Git Template Renderer

```rig
import { agent, p, s } from "rig";
import { defineTool } from "rig";

const parseGitLog = defineTool("parseGitLog", {
  description: "Parse a git log line in format 'HASH|AUTHOR|DATE|SUBJECT' into fields",
  parameters: s.object({ logLine: s.string }),
  handler({ logLine }) {
    const parts = logLine.split("|");
    return {
      commit: parts[0]?.trim() ?? "",
      author: parts[1]?.trim() ?? "",
      date: parts[2]?.trim() ?? "",
      message: parts[3]?.trim() ?? "",
    };
  },
});

// Agent role: render a git-metadata template by filling placeholders from git log output.
const gitTemplateRenderer = agent({
  model: "small",
  tools: [parseGitLog],
  input: s.string,
  instructions: p`Read the template string from input. Gather git metadata: ${p.bash("git log -1 --format='%H|%an|%ad|%s' --date=short 2>/dev/null || echo '|||(no commits)'")} and branch: ${p.bash("git branch --show-current 2>/dev/null || echo 'main'")}. Use the parseGitLog tool to extract fields. Replace {{commit}}, {{author}}, {{branch}}, {{date}}, {{message}} placeholders in the template. Write rendered output via ${p.write("rendered-output.txt", "{{rendered}}")}. Return the rendered text and which placeholders were replaced.`,
  output: s.object({
    rendered: s.string,
    placeholdersReplaced: s.array(s.string),
    outputFile: s.path,
  }),
});

export default gitTemplateRenderer;
```
