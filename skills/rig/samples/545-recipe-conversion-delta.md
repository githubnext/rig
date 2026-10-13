# 545 - Recipe Conversion Delta

```rig
import { agent, p, s } from "rig";

// Agent role: merge a baseline recipe with a sparse list of changed ingredients
// into one row per ingredient, carrying forward unchanged amounts.
const recipeConversionDelta = agent({
  model: "small",
  instructions: p`Baseline recipe (ingredient, amount, unit):
1. Flour, 500, g
2. Sugar, 200, g
3. Butter, 150, g
4. Eggs, 3, count
5. Milk, 250, ml
6. Baking powder, 10, g

Partial update list (only ingredients that changed, with new amounts):
- Flour: 750 g
- Milk: 300 ml
- Eggs: 4 count

For every ingredient in the baseline recipe, produce one row in the output array:
- If the ingredient name appears in the update list, set previousAmount to the
  original baseline amount, newAmount to the updated amount, unit to the unit,
  and changed to true.
- If the ingredient does not appear in the update list, omit previousAmount
  entirely (do not set it to null or 0), set newAmount to the original baseline
  amount, unit to the baseline unit, and changed to false.
Preserve the original baseline order and include every one of the 6 ingredients
exactly once. Return only the declared output.`,
  output: s.array(s.object({
    ingredient: s.string,
    previousAmount: s.optional(s.number),
    newAmount: s.number,
    unit: s.string,
    changed: s.boolean,
  })),
});

export default recipeConversionDelta;
```
