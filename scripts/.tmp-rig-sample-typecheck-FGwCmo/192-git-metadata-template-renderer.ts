import { agent, defineTool, p, s } from "rig";

const parseCommit = defineTool("parseCommit", {
  description: "Parse a pipe-delimited git log line into structured commit fields",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const [hash, author, email, date, ...rest] = line.split("|");
    return { hash, author, email, date, message: rest.join("|") };
  },
});

// Agent role: render a file template using git commit metadata as placeholder values.
const gitMetadataTemplateRenderer = agent({
  model: "typecheck",
  input: s.object({
    templatePath: s.path,
    outputPath: s.path,
  }),
  instructions: p`You are a git metadata template renderer.

Template content:
${p.readInput("templatePath")}

Current commit metadata (hash|author|email|date|message):
${p.bash("git log -1 --format=%H|%an|%ae|%aI|%s")}

Current branch:
${p.bash("git rev-parse --abbrev-ref HEAD")}

Use the parseCommit tool to parse the commit metadata line.
Replace all occurrences of {{commit}}, {{author}}, {{branch}}, {{date}}, {{message}} in the template with their actual values.
Count how many distinct placeholder types were replaced.
${p.writeInput("outputPath", "rendered")}`,
  tools: [parseCommit],
  output: s.object({
    rendered: s.string,
    placeholdersFilled: s.int,
  }),
});

export default gitMetadataTemplateRenderer;
