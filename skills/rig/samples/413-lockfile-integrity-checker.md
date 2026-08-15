# 413 - Lockfile Integrity Checker

```rig
import { agent, defineTool, p, repair, s } from "rig";

const verifyLockEntry = defineTool("verifyLockEntry", {
  description: "Verify a package entry in package-lock.json has required integrity and resolved fields.",
  parameters: s.object({ packageName: s.string, entryJson: s.string }),
  handler({ entryJson }: { packageName: string; entryJson: string }) {
    try {
      const entry = JSON.parse(entryJson) as Record<string, unknown>;
      const hasIntegrity = typeof entry["integrity"] === "string" && (entry["integrity"] as string).length > 0;
      const hasResolved = typeof entry["resolved"] === "string" && (entry["resolved"] as string).length > 0;
      const valid = hasIntegrity && hasResolved;
      return { valid, hasIntegrity, hasResolved };
    } catch {
      return { valid: false, hasIntegrity: false, hasResolved: false };
    }
  },
});

// Agent role: check package-lock.json entries for integrity and resolved fields.
const lockfileIntegrityChecker = agent({
  model: "small",
  instructions: p`Check integrity of package-lock.json entries.

Content:
${p.read("package-lock.json")}

For each package in the "packages" or "dependencies" section, call verifyLockEntry with the package name and its JSON entry (as a string). Build the packages record. mismatchCount = number of invalid entries. isClean = mismatchCount === 0. totalChecked = total packages checked.`,
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
  addons: [repair()],
});

export default lockfileIntegrityChecker;
```
