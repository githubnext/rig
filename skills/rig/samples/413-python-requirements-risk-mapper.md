# 413 - Python Requirements Risk Mapper

```rig
import { agent, p, s, defineTool, steering } from "rig";

// Agent role: classify Python package risk from requirements.txt and pip list output.
const pythonRequirementsRiskMapper = agent({
  model: "small",
  instructions: p`Analyze Python package risk based on requirements.txt and installed packages.

requirements.txt:
${p.readOptional("requirements.txt", "(no requirements.txt found)")}

Installed packages (pip list):
${p.bash("pip list --format=json 2>/dev/null || echo '[]'")}

For each package, call classifyPackageRisk. Packages that are very old (version < 1.0), 
known for past vulnerabilities (e.g. requests<2.20, pyyaml<5.4, pillow<9), 
or have no version pinned are considered high risk. 
Produce the declared output.`,
  tools: [
    defineTool("classifyPackageRisk", {
      description: "Classify a Python package by risk level based on name and version",
      parameters: s.object({ name: s.string, version: s.string }),
      handler({ name, version }: { name: string; version: string }) {
        const n = name.toLowerCase();
        const major = parseInt(version.split(".")[0] ?? "0", 10);
        let risk: "low" | "medium" | "high" = "low";
        let reason = "stable package";
        if (!version || version === "unknown") { risk = "high"; reason = "no version pinned"; }
        else if (major === 0) { risk = "medium"; reason = "pre-1.0 release"; }
        if (/(pyyaml|pillow|requests|urllib3|cryptography)/.test(n) && major < 2) {
          risk = "high"; reason = "known past vulnerability in old version";
        }
        return { name, version, risk, reason };
      },
    }),
  ],
  output: s.object({
    packages: s.record(s.object({
      version: s.string,
      risk: s.enum("low", "medium", "high"),
      reason: s.string,
    })),
    totalPackages: s.int,
    riskyCount: s.int,
    recommendedAction: s.enum("audit", "review", "ok"),
  }),
  addons: [steering()],
});

export default pythonRequirementsRiskMapper;

```
