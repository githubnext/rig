# 439 - Parallel Project Health

```rig
import { workflow, p, s } from "rig";

// Workflow role: Analyze package.json and tsconfig.json in parallel to produce a project health report.
export default workflow({
  meta: { name: "project-health", description: "Parallel analysis of package.json and tsconfig.json.", phases: ["Analyze", "Score"] },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const [pkgResult, tsResult] = await Promise.all([
      call.json(
        p`Read package.json: ${p.read("package.json")}. Extract all scripts and count them.`,
        s.object({ scripts: s.record(s.string), scriptCount: s.int }),
      ),
      call.json(
        p`Read tsconfig.json: ${p.read("tsconfig.json")}. Report whether strict, paths, and esModuleInterop are enabled.`,
        s.object({ strict: s.boolean, paths: s.boolean, esModuleInterop: s.boolean }),
      ),
    ]);
    phase("Score");
    const healthScore = await call.json(
      `Given scriptCount=${pkgResult?.scriptCount ?? 0}, strict=${tsResult?.strict}, paths=${tsResult?.paths}, esModuleInterop=${tsResult?.esModuleInterop}: compute an overall health score 0-100.`,
      s.int,
    );
    return {
      scripts: pkgResult?.scripts ?? {},
      scriptCount: pkgResult?.scriptCount ?? 0,
      tsconfig: { strict: tsResult?.strict ?? false, paths: tsResult?.paths ?? false, esModuleInterop: tsResult?.esModuleInterop ?? false },
      healthScore: healthScore ?? 0,
    };
  },
});
```
