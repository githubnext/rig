# 547 - Lab Result Steered Translation

```rig
import { agent, p, repair, s, steering } from "rig";

// Agent role: parse an embedded lab measurement log into structured, locale-constrained readings.
const translateLabResults = agent({
  model: "small",
  maxTurns: 4,
  instructions: p`Read the lab measurement log below and produce a structured report.

Lab measurement log:
1. Sample weight: 12.5 mg
2. 試料容積 (sample volume): 3.2 mL
3. Reagent dose: 450 milligrams
4. 反応時間 (reaction time): 15 分 (value 15, unit "min")
5. Buffer volume: 5 mL
6. Catalyst mass: 0.75 mg
7. pH adjustment reagent: 2 milligrams
8. 温度補正 (temperature correction): 0.5 (unit "C")

For each measurement, emit a label (English or Japanese text as shown), a
labelLocale that is ONLY "en" or "ja" — never any other locale code, script
tag, or variant, even if the source text mixes languages. Normalize mixed
unit notation ("mg" and "milligrams" both become "mg"; keep "mL", "min", "C"
as given). Parse the numeric value as a plain number; if a value looks
malformed or ambiguous, infer the most reasonable number from context
instead of leaving it non-numeric. Write a one-paragraph summary of the
measurement batch.`,
  output: s.object({
    summary: s.string,
    measurements: s.array(
      s.object({
        label: s.string,
        labelLocale: s.enum("en", "ja"),
        value: s.number,
        unit: s.string,
      })
    ),
  }),
  addons: [steering(), repair()],
});

export default translateLabResults;
```
