import { agent, defineTool, p, s } from "rig";

const parseGitLogLine = defineTool("parseGitLogLine", {
  description: "Parse a git log line in format 'HASH|AUTHOR|EMAIL|DATE|SUBJECT' into structured fields",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const parts = line.split("|");
    if (parts.length < 5) return null;
    const [hash, author, email, date, ...subjectParts] = parts;
    return { hash, author, email, date, subject: subjectParts.join("|") };
  },
});

// Agent role: read a template file, fill git metadata placeholders, and write the rendered output.
const gitMetadataTemplateRenderer = agent({
  model: "typecheck",
  tools: [parseGitLogLine],
  instructions: p`Read the template using ${p.read("docs/commit-template.md")}. Gather recent commit metadata: ${p.bash("git log --format='%H|%an|%ae|%ai|%s' -10 2>/dev/null || echo ''")} and current branch: ${p.bash("git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown'")}. Use parseGitLogLine to parse each log line. Replace {{commit}}, {{author}}, {{branch}}, {{date}}, {{message}} placeholders in the template with actual values. Write the rendered content using ${p.writeOutput("renderedContent", "docs/commit-rendered.md")}. Return which placeholders were replaced.`,
  output: s.object({
    rendered: s.boolean,
    placeholdersReplaced: s.array(s.string),
    outputPath: s.path,
    renderedContent: s.string,
  }),
});

export default gitMetadataTemplateRenderer;
