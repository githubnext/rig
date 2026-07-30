import { agent, p, s } from "rig";

// Agent role: compare installed npm package versions against latest published versions and report drift.
const pkgVersionDrift = agent({
  model: "typecheck",
  instructions: p`Compare installed npm package versions to the latest published versions.

Package manifest: ${p.read("package.json")}

Installed versions: ${p.bash("npm ls --depth=0 --json 2>/dev/null | head -200")}

Latest versions for key packages: ${p.bash("npm outdated --json 2>/dev/null | head -200 || echo '{}'")}

For each dependency, classify driftLevel: ok (up to date), patch (patch version behind), minor (minor version behind), major (major version behind). Write a human-readable drift summary report via ${p.writeOutput("report", "version-drift-report.md")}. Set reportWritten to true.`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      current: s.string,
      latest: s.string,
      driftLevel: s.enum("ok", "patch", "minor", "major"),
    })),
    reportWritten: s.boolean,
    report: s.string,
  }),
});

export default pkgVersionDrift;
