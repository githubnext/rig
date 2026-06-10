import { agent, p, s } from "rig";

// Agent role: extract package scripts and summarize what they do.
const extractScripts = agent({
  model: "mini",
  instructions: p`Read ${p.read("package.json")} and summarize the package scripts. Use ${p.bash("find src -name '*.ts' -type f | sort")} only to call out source files that look relevant.`,
  output: s.object({
    scriptsByName: s.record(s.string),
    summary: s.string,
    relatedFiles: s.array(s.string),
  }),
});

export default extractScripts;
