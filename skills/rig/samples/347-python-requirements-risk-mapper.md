# 347 - Python Requirements Risk Mapper

```rig
import { agent, p, s, defineTool, steering } from "rig";

const classifyPackageRisk = defineTool("classifyPackageRisk", {
  description: "Classify a Python package's risk level based on name and version heuristics",
  parameters: s.object({ name: s.string, version: s.string }),
  handler({ name, version }) {
    const knownLegacy = ["django", "flask", "requests", "urllib3", "cryptography", "pillow", "numpy"];
    const versionParts = version.split(".").map(Number);
    const major = versionParts[0] ?? 0;
    const isOutdated = major === 0 || (knownLegacy.includes(name.toLowerCase()) && major < 2);
    const riskLevel: "low" | "medium" | "high" =
      isOutdated && knownLegacy.includes(name.toLowerCase()) ? "high" as const
      : isOutdated ? "medium" as const
      : "low" as const;
    return { isOutdated, riskLevel };
  },
});

// Agent role: map Python requirements to risk levels and recommend an action.
const pythonRequirementsRiskMapper = agent({
  model: "small",
  instructions: p`requirements.txt: ${p.readOptional("requirements.txt", "# no requirements.txt found")}
installed packages: ${p.bash("pip list --format=json 2>/dev/null || echo '[]'")}

For each package found in requirements.txt or the installed list, call classifyPackageRisk with its name and version. Build a packages record. Count riskyCount (medium or high risk). Choose recommendedAction: audit if any high-risk, review if any medium-risk, ok otherwise.`,
  output: s.object({
    packages: s.record(s.object({
      version: s.string,
      isOutdated: s.boolean,
      riskLevel: s.enum("low", "medium", "high"),
    })),
    totalPackages: s.int,
    riskyCount: s.int,
    recommendedAction: s.enum("audit", "review", "ok"),
  }),
  tools: [classifyPackageRisk],
  addons: [steering()],
  maxTurns: 5,
});

export default pythonRequirementsRiskMapper;
```
