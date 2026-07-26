# 164 - Stale Dependency Detector

```rig
import { agent, defineTool, p, s } from "rig";

// Agent role: detect stale npm dependencies by comparing installed versions with latest published versions.
const staleDependencyDetector = agent({
  model: "small",
  instructions: p`Identify stale npm dependencies that need updating.

package.json contents:
${p.read("package.json")}

npm outdated results:
${p.bash("npm outdated --json 2>/dev/null || echo '{}'")}

Use the classifyDrift tool for each outdated package to classify the version drift level. Determine the overall risk for the project. Return only the declared output.`,
  tools: [
    defineTool("classifyDrift", {
      description: "Classify version drift between current and latest version",
      parameters: s.object({ current: s.string, latest: s.string }),
      handler({ current, latest }) {
        const parse = (v: string) => v.replace(/^[^0-9]*/, "").split(".").map(Number);
        const [cMaj, cMin] = parse(current);
        const [lMaj, lMin] = parse(latest);
        if (lMaj > cMaj) return { driftLevel: "major" as const };
        if (lMin > cMin) return { driftLevel: "minor" as const };
        return { driftLevel: "patch" as const };
      },
    }),
  ],
  output: s.object({
    packages: s.array(s.object({
      name: s.string,
      current: s.string,
      latest: s.string,
      driftLevel: s.enum("major", "minor", "patch", "ok"),
    })),
    overallRisk: s.enum("safe", "moderate", "critical"),
    staleCount: s.int,
  }),
});

export default staleDependencyDetector;
```
