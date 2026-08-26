# 461 - Package Scripts Trio Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: list all npm scripts from package.json.
const scriptsLister = agent({
  name: "scriptsLister",
  model: "small",
  instructions: p`List all npm scripts from this project.
${p.read("package.json")}
Return all script names from the "scripts" field as an array.`,
  output: s.object({ scripts: s.array(s.string) }),
});

// Agent role: categorize npm scripts by purpose.
const scriptsCategorizer = agent({
  name: "scriptsCategorizer",
  model: "small",
  input: s.object({ scripts: s.array(s.string) }),
  instructions: `Classify each script name into build, test, lint, release, utility, or other.
Return a record mapping category to the list of script names in it, plus the dominantCategory.`,
  output: s.object({
    categories: s.record(s.array(s.string)),
    dominantCategory: s.enum("build", "test", "lint", "release", "utility", "other"),
  }),
});

// Agent role: check installed dependency health via npm ls.
const scriptsHealthChecker = agent({
  name: "scriptsHealthChecker",
  model: "small",
  instructions: p`Check installed npm dependency health.
${p.bash("npm ls --depth=0 2>&1 | tail -30")}
List any packages that appear missing or broken, and classify overall health.`,
  output: s.object({
    missingDeps: s.array(s.string),
    dependencyHealth: s.enum("ok", "warnings", "errors"),
  }),
});

// Workflow role: run three package.json analysis agents and produce an overall health verdict.
export default workflow({
  meta: { name: "pkg-scripts-trio", description: "Three-agent package.json scripts and dependency analysis." },
  body: async ({ call, phase }) => {
    phase("Collect");
    const [listed, health] = await Promise.all([
      call(scriptsLister, "list scripts"),
      call(scriptsHealthChecker, "check dependency health"),
    ]);
    const scripts = listed?.scripts ?? [];
    phase("Categorize");
    const categorized = await call(scriptsCategorizer, { scripts });
    phase("Summarize");
    return call.json(
      `scripts=${JSON.stringify(scripts)} categories=${JSON.stringify(categorized?.categories ?? {})} missingDeps=${JSON.stringify(health?.missingDeps ?? [])} dependencyHealth=${health?.dependencyHealth ?? "ok"}. Determine overallHealth: healthy if dependencyHealth=ok and scripts non-empty, needs-attention if warnings or empty scripts, critical if errors or missing deps.`,
      s.object({
        overallHealth: s.enum("healthy", "needs-attention", "critical"),
        summary: s.string,
      }),
    );
  },
});
```
