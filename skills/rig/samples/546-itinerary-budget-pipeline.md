# 546 - Itinerary Budget Pipeline

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: estimate the daily cost of a fixed 5-day itinerary.
const costEstimator = agent({
  model: "small",
  instructions: p`Estimate daily USD cost for this 5-day itinerary:
Day 1: Arrive, city walking tour, street food dinner.
Day 2: Guided museum tour, mid-range lunch, evening river cruise.
Day 3: Day trip to coastal town, rental car, seafood dinner.
Day 4: Cooking class, souvenir shopping, rooftop bar.
Day 5: Spa morning, farewell fine-dining dinner, airport transfer.
Return one estimated cost per day.`,
  output: s.array(s.object({ day: s.int, estimatedCost: s.number })),
});

// Agent role: flag which days exceed the fixed daily budget.
const budgetChecker = agent({
  model: "small",
  input: s.object({ costs: s.array(s.object({ day: s.int, estimatedCost: s.number })) }),
  instructions:
    "Given input.costs, the fixed daily budget is $150. Flag overBudget true when estimatedCost exceeds $150, and report the amount per day.",
  output: s.array(s.object({ day: s.int, overBudget: s.boolean, amount: s.number })),
});

// Agent role: produce a free-form adjusted itinerary report for over-budget days only.
const adjustmentReport = agent({
  model: "small",
  input: s.object({ flagged: s.array(s.object({ day: s.int, overBudget: s.boolean, amount: s.number })) }),
  instructions:
    "Given input.flagged (already filtered to over-budget days), write a free-form adjusted itinerary report with cheaper alternatives, and count days adjusted.",
  output: s.object({ report: s.string, daysAdjusted: s.int }),
});

// Workflow role: estimate costs, flag over-budget days, then report on only that variable-size subset.
const itineraryBudgetPipeline = workflow({
  meta: {
    name: "itinerary-budget-pipeline",
    description: "Estimate costs, flag over-budget days, and report on a variable-size subset",
    phases: ["Estimate", "Check", "Report"],
  },
  body: async ({ call, phase }) => {
    phase("Estimate");
    const costs = await call(costEstimator, "estimate costs", { label: "estimate" });

    phase("Check");
    const flagged = await call(budgetChecker, { costs: costs ?? [] }, { label: "check" });
    const overBudgetDays = (flagged ?? []).filter((d) => d.overBudget);

    phase("Report");
    return call(adjustmentReport, { flagged: overBudgetDays }, { label: "report" });
  },
});

export default itineraryBudgetPipeline;
```
