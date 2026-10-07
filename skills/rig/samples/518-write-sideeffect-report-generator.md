# 518 - Write Sideeffect Report Generator

```rig
import { agent, p, s } from "rig";

// Agent role: inspect package.json dependencies, draft a markdown dependency
// report, persist it to disk, and return a structured summary.
const dependencyReportGenerator = agent({
  model: "mini",
  instructions: p`Inspect ${p.read("package.json")}.
    Count the total number of entries across "dependencies" and "devDependencies".
    Draft a concise markdown dependency report listing each dependency and its
    declared version, with a short section flagging any dependencies whose
    version appears unusually old or loosely pinned (your best guess list).
    ${p.writeOutput("reportMarkdown", "DEPENDENCY_REPORT.md")}
    Return the declared output: the total dependency count, the list of
    package names you flagged as possibly outdated, the markdown report
    content itself, and the path the report was written to
    ("DEPENDENCY_REPORT.md").`,
  output: s.object({
    totalDeps: s.number,
    outdatedGuess: s.array(s.string),
    reportMarkdown: s.string,
    reportPath: s.string,
  }),
});

export default dependencyReportGenerator;
```
