# 530 - Bug Template Stub Writer

```rig
import { agent, p, s } from "rig";

// Agent role: conditionally write a bug-report issue template stub if one does not already exist.
const bugTemplateWriter = agent({
  model: "small",
  instructions: p`Read ${p.read("package.json")} to find the project name and description. Check whether a bug report template already exists at .github/ISSUE_TEMPLATE/bug_report.md: ${p.bash("test -f .github/ISSUE_TEMPLATE/bug_report.md && echo exists || echo missing")}. If it is missing, write a minimal bug-report template to /tmp/gh-aw/agent/bug_report.md: ${p.write("/tmp/gh-aw/agent/bug_report.md", "---\nname: Bug report\nabout: Report a problem\nlabels: bug\n---\n\n## Description\n\n## Steps to reproduce\n")}. If a template already exists, do not write anything. Report whether a template was written, the path considered, and which template fields were included (name, description, labels).`,
  output: s.object({
    templateWritten: s.boolean,
    path: s.path,
    fieldsIncluded: s.array(s.enum("name", "description", "labels")),
  }),
});

export default bugTemplateWriter;
```
