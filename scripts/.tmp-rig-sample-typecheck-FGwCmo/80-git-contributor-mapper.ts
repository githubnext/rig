import { agent, p, s } from "rig";

// Agent role: map git contributors to their commit counts, primary work areas, and role classification.
const gitContributorMapper = agent({
  model: "typecheck",
  instructions: p`Analyze git contributors using: ${p.bash("git shortlog -sn --no-merges")} and ${p.bash("git log --no-merges --name-only --pretty=format:'%an' | head -500")}. For each contributor, count their commits, identify which directories they primarily touch, and classify their role as core (many commits across many files), peripheral (few commits or limited scope), or single-file.`,
  output: s.record(s.object({
    commitCount: s.number,
    primaryAreas: s.array(s.string),
    role: s.enum("core", "peripheral", "single-file"),
  })),
});

export default gitContributorMapper;
