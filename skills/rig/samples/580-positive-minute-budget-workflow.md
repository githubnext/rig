# 580 - Positive Minute Budget Workflow

```rig
import { agent, p, s, workflow } from "rig";
// Agent role: estimate positive lesson minutes and priority for each supplied session.
const estimateSessions = agent({
  name: "lesson-estimator",
  model: "large",
  input: s.object({
    sessions: s.array(s.object({
      id: s.string, day: s.int, topic: s.string, level: s.enum("beginner", "intermediate"),
    })),
  }),
  instructions: p`Estimate each session using only input.sessions. Preserve every id and day, return a positive estimatedMinutes value, and rank sessions by priority.
${p.bash("printf %s synthetic-only")}
Do not invent sessions.`,
  output: s.array(s.object({
    id: s.string, day: s.int, estimatedMinutes: s.positiveInt, priority: s.int,
  })),
});
// Agent role: allocate positive lesson minutes without exceeding any daily budget.
const allocateSessions = agent({
  name: "lesson-allocator",
  model: "small",
  input: s.object({
    estimates: s.array(s.object({
      id: s.string, day: s.int, estimatedMinutes: s.positiveInt, priority: s.int,
    })),
    dailyBudgets: s.record(s.positiveInt),
  }),
  instructions: "Process estimates in order. Schedule a session only when its positive estimatedMinutes fit in the remaining budget for its day; otherwise put its id in unscheduledSessionIds. Never emit zero or negative minutes, never exceed a daily budget, and set stop.stopped and stop.reason to explain completion or the first exhausted constraint.",
  output: s.object({
    schedule: s.array(s.object({ id: s.string, day: s.int, minutes: s.positiveInt })),
    unscheduledSessionIds: s.array(s.string),
    stop: s.object({ stopped: s.boolean, reason: s.enum("completed", "budget_exhausted", "no_positive_capacity") }),
  }),
});
// Workflow role: estimate a fixed lesson set, then allocate a bounded per-day timeline.
const positiveMinuteBudgetWorkflow = workflow({
  meta: {
    name: "positive-minute-budget-workflow",
    description: "Estimate and schedule synthetic language lessons within positive daily budgets",
    phases: ["Estimate", "Allocate"],
  },
  body: async ({ call, phase }) => {
    const sessions = [
      { id: "greetings", day: 1, topic: "Greetings", level: "beginner" as const },
      { id: "food", day: 1, topic: "Ordering food", level: "beginner" as const },
      { id: "directions", day: 2, topic: "Asking directions", level: "beginner" as const },
      { id: "past-tense", day: 2, topic: "Past tense", level: "intermediate" as const },
      { id: "conversation", day: 3, topic: "Free conversation", level: "intermediate" as const },
    ];
    const dailyBudgets = { "1": 25, "2": 30, "3": 20 };
    phase("Estimate");
    const estimates = await call(estimateSessions, { sessions }, { label: "estimate" });
    phase("Allocate");
    return call(allocateSessions, { estimates: estimates ?? [], dailyBudgets }, { label: "allocate" });
  },
});
export default positiveMinuteBudgetWorkflow;
```
