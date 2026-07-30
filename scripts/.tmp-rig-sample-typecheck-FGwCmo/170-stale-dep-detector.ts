import { agent, p, s, repair } from "rig";
import { defineTool } from "rig";

const classifyDrift = defineTool("classifyDrift", {
  description: "Classify version drift between current and latest semver strings",
  parameters: s.object({ current: s.string, latest: s.string }),
  handler({ current, latest }) {
    const parse = (v: string) => v.replace(/^[^0-9]*/, "").split(".").map(Number);
    const [cMaj, cMin] = parse(current);
    const [lMaj, lMin] = parse(latest);
    if (lMaj > cMaj) return "major";
    if (lMin > cMin) return "minor";
    if (latest !== current) return "patch";
    return "ok";
  },
});

// Agent role: detect stale npm dependencies and classify version drift.
const staleDependencyDetector = agent({
  model: "typecheck",
  maxTurns: 3,
  addons: repair(),
  tools: [classifyDrift],
  instructions: p`Analyze outdated npm packages using ${p.bash("npm outdated --json 2>/dev/null || echo '{}'")} and the manifest ${p.read("package.json")}. For each outdated package, use the classifyDrift tool to determine drift level. Compute overallRisk: "critical" if any major drift, "moderate" if any minor drift, else "safe".`,
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      current: s.string,
      latest: s.string,
      driftLevel: s.enum("major", "minor", "patch", "ok"),
    })),
    overallRisk: s.enum("safe", "moderate", "critical"),
  }),
});

export default staleDependencyDetector;
