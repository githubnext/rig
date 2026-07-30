import { agent, p, s, defineTool, repair } from "rig";

const extractLicense = defineTool("extractLicense", {
  description: "Extract the SPDX license identifier from a package's license field or LICENSE file content",
  parameters: s.object({ packageName: s.string, licenseField: s.string }),
  handler: ({ packageName, licenseField }) => {
    const permissive = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "Unlicense", "CC0-1.0", "0BSD"];
    const copyleft = ["GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0", "AGPL-3.0", "MPL-2.0"];
    const id = licenseField.trim().toUpperCase();
    let compatibility: string;
    if (permissive.some((l: string) => id.includes(l.toUpperCase()))) {
      compatibility = "permissive";
    } else if (copyleft.some((l: string) => id.includes(l.toUpperCase()))) {
      compatibility = "copyleft";
    } else if (id === "UNLICENSED" || id === "") {
      compatibility = "proprietary";
    } else {
      compatibility = "unknown";
    }
    return JSON.stringify({ packageName, spdxId: licenseField, compatibility });
  },
});

// Agent role: audit npm dependency licenses and build a compatibility matrix
const depLicenseMatrix = agent({
  name: "depLicenseMatrix",
  model: "typecheck",
  addons: repair(),
  tools: [extractLicense],
  instructions: p`Audit npm dependency licenses and classify compatibility.

package.json: ${p.read("package.json")}

Installed package licenses: ${p.bash("cat node_modules/*/package.json 2>/dev/null | grep -E '\"name\"|\"license\"' | paste - - | head -60 || echo 'Run npm install first'")}

For each direct dependency, call extractLicense with the package name and its license field value.
Classify compatibility:
- permissive: MIT, ISC, BSD, Apache-2.0, etc.
- copyleft: GPL, LGPL, AGPL, MPL, etc.
- proprietary: UNLICENSED or empty
- unknown: unrecognized SPDX identifier

Compute copyleftCount and unknownCount.
Set hasConflicts to true if any copyleft or proprietary licenses are present.`,
  output: s.object({
    packages: s.record(
      s.object({
        spdxId: s.string,
        compatibility: s.enum("permissive", "copyleft", "proprietary", "unknown"),
      })
    ),
    copyleftCount: s.int,
    unknownCount: s.int,
    hasConflicts: s.boolean,
  }),
});

export default depLicenseMatrix;
