# 51 - Subagent Task Harness for Rig Markdown

```rig
import { agent, p, s } from "rig";
// Agent role: draft a runnable rig markdown snippet for the requested task.
const draftRigMarkdown = agent({
  model: "mini",
  output: s.object({ markdown: s.string }),
  instructions: "Return exactly one markdown response with one ```rig fenced block.",
});
// Agent role: validate generated rig code by running TypeScript in no-emit mode.
const typecheckRigProgram = agent({
  model: "typecheck",
  output: s.object({ ok: s.boolean, diagnostics: s.string }),
  instructions: p`Run ${p.bash("npx tsc --noEmit --pretty false")} and summarize whether typecheck passed.`,
});
// Agent role: solve the task by delegating to subagents and returning markdown.
const solveTask = agent({
  model: "large",
  output: s.object({ markdown: s.string }),
  agents: { draftRigMarkdown, typecheckRigProgram },
  instructions: "Use the drafting subagent, validate with typecheck, then return one runnable rig markdown snippet.",
});
export default solveTask;
```
