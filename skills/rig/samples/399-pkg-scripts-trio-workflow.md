# 399 - Package Scripts Trio Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: list all available npm scripts from package.json.
const scriptsLister = agent({
  model: "small",
  instructions: p`List all npm scripts available in this project.
${p.read("package.json")}
Return all script names from the "scripts" field.`,
  output: s.object({ scripts: s.array(s.string) }),
});

// Agent role: categorize npm script names by their purpose.
const scriptsCategorizer = agent({
  model: "small",
  input: s.object({ scripts: s.array(s.string) }),
  instructions: p`Classify each script name into build, test, lint, release, utility, or other.
Return a record mapping each category to the list of scripts that belong to it.`,
  output: s.object({ categories: s.record(s.array(s.string)) }),
});

// Agent role: check dependency health using npm ls.
const scriptsHealthChecker = agent({
  model: "small",
  instructions: p`Check installed npm dependency health.
${p.bash("npm ls --depth=0 2>&1 | tail -20")}
Return missing deps list and overall health.`,
  output: s.object({
    missingDeps: s.array(s.string),
    dependencyHealth: s.enum("ok", "warnings", "errors"),
  }),
});

// Workflow role: run three package.json analysis agents and combine results.
const pkgScriptsTrioWorkflow = workflow({
  meta: { name: "pkgScriptsTrio", description: "Three-way package.json scripts analysis", phases: ["Analyze", "Combine"] },
  body: async ({ call, phase }) => {
    phase("Analyze");
    const listed = await call(scriptsLister, "list scripts");
    const health = await call(scriptsHealthChecker, "check health");
    const scripts = listed?.scripts ?? [];
    const categorized = await call(scriptsCategorizer, { scripts });
    phase("Combine");
    const depHealth = health?.dependencyHealth ?? "ok";
    const missingDeps = health?.missingDeps ?? [];
    return call.json(
      `scripts=${JSON.stringify(scripts)} categories=${JSON.stringify(categorized?.categories)} missingDeps=${JSON.stringify(missingDeps)} dependencyHealth=${depHealth}. Determine overallHealth as healthy/needs-attention/critical.`,
      s.object({
        scripts: s.array(s.string),
        categories: s.record(s.array(s.string)),
        missingDeps: s.array(s.string),
        dependencyHealth: s.enum("ok", "warnings", "errors"),
        overallHealth: s.enum("healthy", "needs-attention", "critical"),
      }),
    );
  },
});

export default pkgScriptsTrioWorkflow;
```
