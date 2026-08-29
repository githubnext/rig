# 488 - Parallel Dep Audit Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: audit devDependencies for packages that appear misplaced in dependencies.
const devDepAuditor = agent({
  model: "small",
  instructions: p`Read ${p.read("package.json")}. Extract the devDependencies and dependencies objects. Identify packages that appear in both devDependencies and dependencies (misplaced). Return devCount as the number of devDependencies entries, and misplacedPkgs as the list of package names appearing in both.`,
  output: s.object({
    devCount: s.int,
    misplacedPkgs: s.array(s.string),
  }),
});

// Agent role: audit production dependencies for obvious peer conflicts.
const prodDepAuditor = agent({
  model: "small",
  instructions: p`Read ${p.read("package.json")}. Extract the dependencies and peerDependencies objects. Identify packages listed in peerDependencies that are also explicitly in dependencies (peer conflicts). Return prodCount as the number of dependencies entries, and peerConflicts as the list of conflicting package names.`,
  output: s.object({
    prodCount: s.int,
    peerConflicts: s.array(s.string),
  }),
});

// Workflow role: run both dependency auditors concurrently and combine results.
export default workflow({
  meta: {
    name: "parallel-dep-audit",
    description: "Audit package.json dev and prod dependencies in parallel for misplacements and peer conflicts.",
  },
  body: async ({ call }) => {
    const [devResult, prodResult] = await Promise.all([
      call(devDepAuditor, "Audit devDependencies."),
      call(prodDepAuditor, "Audit prodDependencies."),
    ]);
    if (!devResult || !prodResult) return null;
    const issueCount = devResult.misplacedPkgs.length + prodResult.peerConflicts.length;
    const overallHealth: "healthy" | "warnings" | "critical" =
      issueCount === 0 ? "healthy" : issueCount > 3 ? "critical" : "warnings";
    return {
      devCount: devResult.devCount,
      prodCount: prodResult.prodCount,
      misplacedPkgs: devResult.misplacedPkgs,
      peerConflicts: prodResult.peerConflicts,
      overallHealth,
    };
  },
});
```
