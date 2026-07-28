# 144 - Dep License Auditor

```rig
import { agent, p, s, defineTool } from "rig";

const extractLicense = defineTool("extractLicense", {
  description: "Read license field from a package in node_modules.",
  parameters: s.object({ packageName: s.string }),
  async handler({ packageName }) {
    const { readFileSync } = await import("node:fs");
    try {
      const pkgPath = `node_modules/${packageName}/package.json`;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const license: string = pkg.license ?? pkg.licenses?.[0]?.type ?? "UNKNOWN";
      let category: "permissive" | "copyleft" | "unknown" = "unknown";
      const upper = license.toUpperCase();
      if (["MIT", "ISC", "BSD", "APACHE", "0BSD", "WTFPL"].some((l: string) => upper.includes(l))) {
        category = "permissive";
      } else if (["GPL", "LGPL", "AGPL", "MPL", "EUPL"].some((l: string) => upper.includes(l))) {
        category = "copyleft";
      }
      return { license, category };
    } catch {
      return { license: "UNKNOWN", category: "unknown" as const };
    }
  },
});

// Agent role: Audit dependency licenses and flag copyleft packages.
const depLicenseAuditor = agent({
  model: "small",
  instructions: p`Audit dependency licenses for this project.

List installed packages:
${p.bash("npm ls --json --depth=0 2>/dev/null | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(Object.keys(d.dependencies||{}).join('\\n'))\" 2>/dev/null || ls node_modules | head -50")}

For each package, use the extractLicense tool to get its license and category.
Return packages array, hasCopyleft flag, and totalPackages count.`,
  tools: [extractLicense],
  output: s.object({
    packages: s.array(
      s.object({
        name: s.string,
        license: s.string,
        category: s.enum("permissive", "copyleft", "unknown"),
      }),
    ),
    hasCopyleft: s.boolean,
    totalPackages: s.int,
  }),
});

export default depLicenseAuditor;
```
