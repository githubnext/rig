# 539 - Todo Fixme Parallel Workflow

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: count TODO comments across the repository.
const countTodos = agent({
  model: "small",
  instructions: p`Run ${p.bash("grep -ro 'TODO' src/ | wc -l")} and return the count.`,
  output: s.object({ count: s.int }),
});

// Agent role: count FIXME comments across the repository.
const countFixmes = agent({
  model: "small",
  instructions: p`Run ${p.bash("grep -ro 'FIXME' src/ | wc -l")} and return the count.`,
  output: s.object({ count: s.int }),
});

// Agent role: combine TODO and FIXME counts into a total.
const aggregate = agent({
  model: "small",
  input: s.object({ todoCount: s.int, fixmeCount: s.int }),
  instructions: "Combine input.todoCount and input.fixmeCount into a total.",
  output: s.object({ todoCount: s.int, fixmeCount: s.int, total: s.int }),
});

// Workflow role: count TODO and FIXME comments in parallel, then aggregate.
const commentAudit = workflow({
  meta: {
    name: "comment-audit",
    description: "Count TODO and FIXME comments in parallel and aggregate totals",
    phases: ["Count", "Aggregate"],
  },
  body: async ({ call, parallel, phase }) => {
    phase("Count");
    const [todo, fixme] = await parallel([
      () => call(countTodos, ""),
      () => call(countFixmes, ""),
    ]);
    phase("Aggregate");
    return call(aggregate, {
      todoCount: todo?.count ?? 0,
      fixmeCount: fixme?.count ?? 0,
    });
  },
});

export default commentAudit;
```
