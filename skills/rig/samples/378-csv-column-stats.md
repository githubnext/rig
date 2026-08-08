# 378 - CSV Column Stats Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";

const analyzeColumn = defineTool("analyzeColumn", {
  description: "Analyze a CSV column's values and return statistics.",
  parameters: { columnName: s.string, values: s.array(s.string) },
  handler: ({ columnName, values }: { columnName: string; values: string[] }) => {
    const numericValues = values.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
    const uniqueCount = new Set(values).size;
    const isAllNumeric = numericValues.length === values.filter((v) => v.trim() !== "").length;
    const isMixed = numericValues.length > 0 && !isAllNumeric;
    const type: "numeric" | "string" | "mixed" = isAllNumeric ? "numeric" : isMixed ? "mixed" : "string";
    if (type === "numeric" && numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      return { columnName, type, uniqueCount, min, max, mean };
    }
    return { columnName, type, uniqueCount, min: undefined, max: undefined, mean: undefined };
  },
});

// Agent role: compute per-column statistics for a CSV file.
const csvColumnStatsReporter = agent({
  model: "small",
  input: s.object({ csvFile: s.path }),
  instructions: p`Compute statistics for each column in a CSV file.

CSV contents:
${p.readInput("csvFile")}

Steps:
1. Parse the first line as the header row (comma-separated column names).
2. Parse remaining lines as data rows.
3. For each column, collect its values from all data rows.
4. Call analyzeColumn with the columnName and its values array.
5. Build columns record keyed by column name.
6. rowCount = number of data rows (excluding header).
7. columnCount = number of columns.`,
  output: s.object({
    columns: s.record(
      s.object({
        type: s.enum("numeric", "string", "mixed"),
        uniqueCount: s.int,
        min: s.optional(s.number),
        max: s.optional(s.number),
        mean: s.optional(s.number),
      })
    ),
    rowCount: s.int,
    columnCount: s.int,
  }),
  tools: [analyzeColumn],
  addons: [repair()],
});

export default csvColumnStatsReporter;
```
