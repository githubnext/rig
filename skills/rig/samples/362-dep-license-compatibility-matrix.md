# 362 - Dep License Compatibility Matrix

```rig
import { agent, p, s, defineTool, repair } from "rig";

const extractLicense = defineTool("extractLicense", {
  description: "Read the LICENSE file for an npm package and classify its SPDX license identifier.",
  parameters: { packageName: s.string },
  handler: async ({ packageName }: { packageName: string }) => {
    const { execSync } = await import("node:child_process");
    try {
      const license = execSync(
        `node -e "const p=require('./node_modules/${packageName}/package.json');console.log(p.license||'')" 2>/dev/null`,
        { encoding: "utf-8" }
      ).trim();
      const permissive = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "Unlicense"];
      const copyleft = ["GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0", "AGPL-3.0", "MPL-2.0"];
      if (!license) return { spdxId: "unknown", compatibility: "unknown" as const };
      if (permissive.some((l) => license.includes(l))) return { spdxId: license, compatibility: "permissive" as const };
      if (copyleft.some((l) => license.includes(l))) return { spdxId: license, compatibility: "copyleft" as const };
      if (license.toLowerCase().includes("proprietary") || license.toLowerCase().includes("commercial"))
        return { spdxId: license, compatibility: "proprietary" as const };
      return { spdxId: license, compatibility: "unknown" as const };
    } catch {
      return { spdxId: "unknown", compatibility: "unknown" as const };
    }
  },
});

const depLicenseCompatibilityMatrix = agent({
  model: "small",
  instructions: p`Build a dependency license compatibility matrix.

package.json contents:
${p.read("package.json")}

Steps:
1. Parse the dependencies and devDependencies from package.json.
2. For each package name, call extractLicense to get its spdxId and compatibility.
3. Build a packages record keyed by package name with spdxId and compatibility.
4. copyleftCount = number of packages classified as "copyleft".
5. unknownCount = number classified as "unknown".
6. hasConflicts = true if copyleftCount > 0.`,
  output: s.object({
    packages: s.record(
      s.object({
        spdxId: s.string,
        compatibility: s.enum("permissive", "copyleft", "proprietary", "unknown"),
      })
    ),
    copyleftCount: s.number,
    unknownCount: s.number,
    hasConflicts: s.boolean,
  }),
  tools: [extractLicense],
  addons: [repair()],
});

export default depLicenseCompatibilityMatrix;
```
