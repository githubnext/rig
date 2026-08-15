# 415 - Lockfile Integrity Checker

```rig
import { agent, p, s, defineTool, repair } from "rig";

const verifyLockEntry = defineTool("verifyLockEntry", {
  description: "Verify that a package lock entry has required resolved and integrity fields",
  parameters: s.object({ packageName: s.string, entryJson: s.string }),
  handler: ({ packageName: _packageName, entryJson }: { packageName: string; entryJson: string }) => {
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(entryJson) as Record<string, unknown>;
    } catch {
      return { valid: false, hasIntegrity: false, hasResolved: false };
    }
    const integrityVal = entry["integrity"];
    const resolvedVal = entry["resolved"];
    const hasIntegrity = typeof integrityVal === "string" && integrityVal.length > 0;
    const hasResolved = typeof resolvedVal === "string" && resolvedVal.length > 0;
    return {
      valid: hasIntegrity && hasResolved,
      hasIntegrity,
      hasResolved,
    };
  },
});

// Agent role: Check package-lock.json entries for completeness of resolved and integrity fields.
const lockfileIntegrityChecker = agent({
  model: "small",
  instructions: p`Check the lockfile for integrity and resolved fields.
Contents: ${p.read("package-lock.json")}
For each package in the "packages" or "dependencies" section, use verifyLockEntry with the package name and its JSON entry (serialized as a JSON string).
Return:
- packages: record mapping package name to { valid, hasIntegrity, hasResolved }
- mismatchCount: count of packages where valid is false
- isClean: true if mismatchCount is 0
- totalChecked: total number of packages checked`,
  output: s.object({
    packages: s.record(s.object({
      valid: s.boolean,
      hasIntegrity: s.boolean,
      hasResolved: s.boolean,
    })),
    mismatchCount: s.int,
    isClean: s.boolean,
    totalChecked: s.int,
  }),
  tools: [verifyLockEntry],
  addons: [repair()],
});

export default lockfileIntegrityChecker;
```
