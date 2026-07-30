import { agent, p, s, defineTool } from "rig";

const classifyLicense = defineTool("classifyLicense", {
  description: "Classify a license string as permissive, copyleft, or unknown",
  parameters: s.object({ license: s.string }),
  handler: ({ license }) => {
    const l = license.toLowerCase();
    const permissive = ["mit", "apache", "bsd", "isc", "0bsd", "unlicense", "wtfpl", "cc0", "zlib"];
    const copyleft = ["gpl", "lgpl", "agpl", "mpl", "eupl", "cddl"];
    if (permissive.some((p) => l.includes(p))) return "permissive";
    if (copyleft.some((c) => l.includes(c))) return "copyleft";
    return "unknown";
  },
});

// Agent role: audit npm dependency licenses and flag copyleft or unknown licenses
const depLicenseAuditor = agent({
  name: "depLicenseAuditor",
  model: "typecheck",
  instructions: p`Audit the licenses of npm dependencies in this project.

Direct dependencies: ${p.bash("npm ls --json --depth=0 2>/dev/null | head -200")}

License fields: ${p.bash("cat node_modules/*/package.json 2>/dev/null | grep -E '\"license\"' | sort -u | head -50")}

For each direct dependency, use the classifyLicense tool to classify its license as permissive, copyleft, or unknown.
Assign riskLevel: copyleft=review, unknown=review, permissive=safe; if license is missing set riskLevel=blocked.
Set hasCopyleft to true if any package has classification=copyleft.`,
  output: s.object({
    packages: s.array(
      s.object({
        name: s.string,
        version: s.string,
        license: s.string,
        classification: s.enum("permissive", "copyleft", "unknown"),
        riskLevel: s.enum("safe", "review", "blocked"),
      })
    ),
    hasCopyleft: s.boolean,
    totalPackages: s.int,
  }),
  tools: [classifyLicense],
});

export default depLicenseAuditor;
