# 569 - Measurement Bash Each Normalizer

```rig
import { agent, p, s } from "rig";

const MeasurementReport = s.object({
  measurements: s.array(s.object({
    lineIndex: s.int,
    originalLine: s.string,
    labels: s.object({ en: s.string, ja: s.string }),
    value: s.number,
    unit: s.enum("C", "mm", "g", "mL/min", "rpm"),
  })),
});

// Agent role: deterministically parse scalar manufacturing records, then normalize measurements.
const parseMeasurements = agent({
  name: "parseMeasurements",
  model: "small",
  input: s.object({ records: s.array(s.string) }),
  instructions: p`For each scalar record, run the deterministic parser ${p.bashEach("printf '%s\\n' '{}' | awk -F'|' 'NF==4 {printf \"%s\\t%s\\t%s\\t%s\\n\", $1, $2, $3, $4}'", "records")}. Each result is tab-separated as index, source label, numeric value, and source unit. Preserve each originalLine and its exact lineIndex. Normalize F to C with (F-32)*5/9, in to mm by 25.4, milligrams to g by 1000, and L/min to mL/min by 1000; leave rpm as rpm. Attach exactly these English/Japanese labels: Press temperature/プレス温度, Cut length/切断長, Part mass/部品質量, Coolant flow/冷却液流量, and Spindle speed/主軸回転数. Return one measurement per input record in original order and only the declared output.`,
  output: MeasurementReport,
});

// Agent role: provide embedded indexed manufacturing lines and return normalized results.
const measurementNormalizer = agent({
  model: "small",
  agents: { parseMeasurements },
  instructions: p`Delegate to parseMeasurements with these embedded scalar records, then return its result unchanged:
["1|Press temperature|212|F", "2|Cut length|2.5|in", "3|Part mass|450|milligrams", "4|Coolant flow|1.2|L/min", "5|Spindle speed|1500|rpm"]`,
  output: MeasurementReport,
});

export default measurementNormalizer;
```
