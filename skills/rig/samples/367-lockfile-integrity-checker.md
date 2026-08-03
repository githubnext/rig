# 367 - Lockfile Integrity Checker

```rig
import { agent, p, s, defineTool } from "rig";
import { repair } from "rig";

const verifyLockEntry = defineTool("verifyLockEntry", {
  description: "Verify a lockfile package entry has valid resolved URL and non-empty integrity hash.",
  parameters: s.object({ name: s.string, resolved: s.optional(s.string), integrity: s.optional(s.string) }),
  handler: ({ resolved, integrity }: { name: string; resolved?: string; integrity?: string }) => {
    const hasResolved = typeof resolved === "string" && resolved.startsWith("https://");
    const hasIntegrity = typeof integrity === "string" && integrity.length > 0;
    return { valid: hasResolved && hasIntegrity, hasIntegrity, hasResolved };
  },
});

// Agent role: verify package-lock.json entries have valid resolved URLs and integrity hashes.
const lockfileIntegrityChecker = agent({
  model: "small",
  instructions: p`Verify all package entries in package-lock.json have valid resolved and integrity fields.

package-lock.json:
${p.read("package-lock.json")}

Steps:
1. Parse the lockfile JSON and iterate over packages (lockfileVersion 2/3: packages object, v1: dependencies object).
2. For each package name and entry, call verifyLockEntry with name, resolved, and integrity.
3. Build packages record keyed by name with valid, hasIntegrity, hasResolved.
4. Count mismatchCount (valid=false) and set isClean = mismatchCount === 0.
5. Set totalChecked = number of packages checked.`,
  output: s.object({
    packages: s.record(s.object({
      valid: s.boolean,
      hasIntegrity: s.boolean,
      hasResolved: s.boolean,
    })),
    mismatchCount: s.number,
    isClean: s.boolean,
    totalChecked: s.number,
  }),
  tools: [verifyLockEntry],
  maxTurns: 6,
  addons: [repair()],
});

export default lockfileIntegrityChecker;
```
