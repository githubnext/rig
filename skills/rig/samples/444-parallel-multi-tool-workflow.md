# 444 - Parallel Multi Tool Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Count files grouped by extension in the workspace.
const fileCountAgent = agent({
  model: "small",
  instructions: p`Run ${p.bash("find . -type f -name '*.*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn")} and return extension counts as a record mapping extension to count.`,
  output: s.object({
    extCounts: s.record(s.int),
  }),
});

// Agent role: Count environment variables and assess health.
const envHealthAgent = agent({
  model: "small",
  instructions: p`Run ${p.bash("env | wc -l")} to count total environment variables. Return the count and whether healthy (count > 0).`,
  output: s.object({
    totalEnvVars: s.int,
    healthy: s.boolean,
  }),
});

// Agent role: Merge file and env summaries into an overall health report.
const coordinatorAgent = agent({
  model: "small",
  input: s.object({
    fileSummary: s.record(s.int),
    envTotalVars: s.int,
    envHealthy: s.boolean,
  }),
  instructions: `Given fileSummary, envTotalVars, and envHealthy, produce an overall health assessment.
If envTotalVars > 0 and fileSummary has entries, overallHealth is healthy.
If one is empty, it is degraded. Otherwise unknown.`,
  output: s.object({
    fileSummary: s.record(s.int),
    envSummary: s.object({ totalEnvVars: s.int, healthy: s.boolean }),
    overallHealth: s.enum("healthy", "degraded", "unknown"),
  }),
});

// Workflow role: Run file count and env health agents in parallel, then merge results.
const parallelMultiToolWorkflow = workflow({
  meta: { name: "parallel-multi-tool-workflow", description: "Run file count and env health checks in parallel, then merge results" },
  body: async ({ call }) => {
    const [fileResult, envResult] = await Promise.all([
      call(fileCountAgent, "analyze file extensions"),
      call(envHealthAgent, "analyze environment variables"),
    ]);
    return call(coordinatorAgent, {
      fileSummary: fileResult?.extCounts ?? {},
      envTotalVars: envResult?.totalEnvVars ?? 0,
      envHealthy: envResult?.healthy ?? false,
    });
  },
});

export default parallelMultiToolWorkflow;
```
