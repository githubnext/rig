# 565 - Timed Measurement Normalizer

```rig
import { agent, p, repair, s, steering, timeout } from "rig";

// Agent role: normalize a multilingual scientific measurement table with explicit timeout accounting.
const normalizeMeasurements = agent({
  model: "small",
  maxTurns: 5,
  addons: [timeout({ timeout: 8_000 }), steering(), repair()],
  instructions: p`Normalize this semicolon-delimited scientific measurement table:
${p.bash("printf '%s' 'r-01 | 温度 | 25 °C | ja; r-02 | Sample mass | 12.5 milligrams | en; r-03 | Volume échantillon | 3,2 mL | fr; r-04 | 反応時間 | 15 分 | ja; r-05 | Pressure | 101.3 kPa | en; r-06 | Masse du catalyseur | 0,75 milligrammes | fr; r-07 | Buffer volume | 5 mL | en; r-08 | 温度補正 | 0,5 C | ja')")}

Process rows in source order. Preserve each rowId and label, copy its locale into labelLocale,
and normalize decimal commas and units to plain numeric values and these units only:
"mg", "mL", "min", "C", or "kPa". Convert milligrams/milligrammes to mg, 分 to min,
and °C to C. Return only the declared object, with processedCount matching processedRows.length.
The timeout addon bounds a model turn; it does not return partial model text. If the time budget
expires before a row is fully processed, include completed rows only and put every unprocessed
row ID explicitly in skippedRowIds. Set truncatedDueToTimeout accordingly; never invent a row
or claim that timeout supplied partial text. Keep the output valid so repair can correct any
schema or JSON mistake.`,
  output: s.object({
    processedCount: s.int,
    processedRows: s.array(s.object({
      rowId: s.enum("r-01", "r-02", "r-03", "r-04", "r-05", "r-06", "r-07", "r-08"),
      label: s.string,
      labelLocale: s.enum("en", "ja", "fr"),
      value: s.number,
      unit: s.enum("mg", "mL", "min", "C", "kPa"),
    })),
    skippedRowIds: s.array(s.enum("r-01", "r-02", "r-03", "r-04", "r-05", "r-06", "r-07", "r-08")),
    truncatedDueToTimeout: s.boolean,
  }),
});

export default normalizeMeasurements;
```
