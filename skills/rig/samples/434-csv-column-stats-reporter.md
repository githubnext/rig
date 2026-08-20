# 434 - CSV Column Stats Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const analyzeColumn = defineTool("analyzeColumn", {
  description: "Analyze a CSV column and compute statistics.",
  parameters: s.object({ name: s.string, values: s.array(s.string) }),
  handler({ values }) {
    const nums = values.map(Number).filter((n) => !isNaN(n) && values[0] !== "");
    const uniqueCount = new Set(values).size;
    if (nums.length === values.length && values.length > 0) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      return { type: "numeric" as const, uniqueCount, min, max, mean };
    }
    if (nums.length > 0 && nums.length < values.length) {
      return { type: "mixed" as const, uniqueCount };
    }
    return { type: "string" as const, uniqueCount };
  },
});

// Agent role: Analyze CSV column statistics including min, max, mean for numeric columns.
const csvColumnStatsReporter = agent({
  model: "small",
  input: s.object({ csvFile: s.path }),
  instructions: p`Read the CSV file: ${p.readInput("csvFile")}. For each column, use analyzeColumn with the column name and all its values. Return column statistics.`,
  output: s.object({
    columns: s.record(s.object({
      type: s.enum("numeric", "string", "mixed"),
      uniqueCount: s.int,
      min: s.optional(s.number),
      max: s.optional(s.number),
      mean: s.optional(s.number),
    })),
    rowCount: s.int,
    columnCount: s.int,
  }),
  tools: [analyzeColumn],
  addons: [repair()],
});

export default csvColumnStatsReporter;
```
