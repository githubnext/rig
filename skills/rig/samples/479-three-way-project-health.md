# 479 - Three Way Project Health

```rig
import { agent, p, s } from "rig";

// Agent role: run npm audit and count vulnerabilities.
const dependencyAuditor = agent({
  model: "small",
  instructions: p`Run ${p.bash("npm audit --json 2>/dev/null | head -5000 || echo '{\"metadata\":{\"vulnerabilities\":{\"total\":0,\"critical\":0}}}'")}.  Parse the JSON and extract total vulnerabilities and critical count. If parsing fails, return 0 for both.`,
  output: s.object({
    vulnerabilities: s.int,
    critical: s.int,
  }),
});

// Agent role: check test coverage from coverage-summary.json.
const testCoverageChecker = agent({
  model: "small",
  instructions: p`Look for coverage data: ${p.bash("find . -name coverage-summary.json -maxdepth 5 2>/dev/null | head -1 | xargs cat 2>/dev/null || echo '{}'")}. Extract the statements coverage percentage. If not found, return 0.`,
  output: s.object({
    coveragePct: s.number,
  }),
});

// Agent role: run TypeScript type-check and count errors.
const typeCheckAgent = agent({
  model: "small",
  instructions: p`Run ${p.bash("npx tsc --noEmit 2>&1 | tail -20 || true")}. Count the number of error lines (lines containing 'error TS'). Return hasErrors and errorCount.`,
  output: s.object({
    hasTypeErrors: s.boolean,
    typeErrorCount: s.int,
  }),
});

// Agent role: coordinate three-way project health checks and compute overall health.
const projectHealthCoordinator = agent({
  model: "small",
  agents: { dependencyAuditor, testCoverageChecker, typeCheckAgent },
  instructions: "Call all three subagents (dependencyAuditor, testCoverageChecker, typeCheckAgent) and collect their results. Then compute overallHealth: critical (critical vulnerabilities > 0 or typeErrorCount > 10), warning (vulnerabilities > 0, typeErrorCount > 0, or coveragePct < 50), healthy (otherwise). Return all combined fields.",
  output: s.object({
    vulnerabilities: s.int,
    critical: s.int,
    coveragePct: s.number,
    hasTypeErrors: s.boolean,
    typeErrorCount: s.int,
    overallHealth: s.enum("healthy", "warning", "critical"),
  }),
});

export default projectHealthCoordinator;
```
