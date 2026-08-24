# 454 - Parallel Multi Tool Workflow

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Count files grouped by extension in the workspace.
const fileCountAgent = agent({
  model: "small",
  instructions: p`Count files by extension using: ${p.bash("find . -type f -not -path './.git/*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -20")}. Return extCounts mapping each extension to its count.`,
  output: s.object({
    extCounts: s.record(s.int),
  }),
});

// Agent role: Count environment variables grouped by prefix category.
const envHealthAgent = agent({
  model: "small",
  instructions: p`Analyze environment variables using: ${p.bash("env | cut -d= -f1 | sed 's/_.*$//' | sort | uniq -c | sort -rn | head -20")}. Return categories mapping each prefix to its count.`,
  output: s.object({
    categories: s.record(s.int),
  }),
});

// Workflow role: Run fileCountAgent and envHealthAgent then synthesize an overall health assessment.
const parallelMultiToolWorkflow = workflow({
  meta: { name: "parallel-multi-tool-workflow", description: "Run file count and env health agents and combine results" },
  body: async ({ call, phase }) => {
    phase("Gather");
    const fileSummary = await call(fileCountAgent, "Analyze", { label: "file-count" });
    const envSummary = await call(envHealthAgent, "Analyze", { label: "env-health" });
    phase("Synthesize");
    const totalFiles = Object.values(fileSummary?.extCounts ?? {}).reduce((a: number, b: unknown) => a + (b as number), 0);
    const totalEnv = Object.values(envSummary?.categories ?? {}).reduce((a: number, b: unknown) => a + (b as number), 0);
    const overallHealth: "healthy" | "degraded" | "unknown" = totalFiles > 0 && totalEnv > 0 ? "healthy" : totalFiles > 0 || totalEnv > 0 ? "degraded" : "unknown";
    return { fileSummary: fileSummary ?? { extCounts: {} }, envSummary: envSummary ?? { categories: {} }, overallHealth };
  },
});

export default parallelMultiToolWorkflow;

```
