# 376 - CSV to Markdown Table

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseCSVRow = defineTool("parseCSVRow", {
  description: "Parse a single CSV row into an array of cell values, handling quoted fields.",
  parameters: s.object({ row: s.string, delimiter: s.string }),
  handler({ row, delimiter }) {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  },
});

// Agent role: convert a CSV file to a Markdown table with optional statistics.
const csvToMarkdownTable = agent({
  model: "small",
  input: s.object({
    csvFile: s.path,
    outputFile: s.path,
    includeStats: s.boolean,
  }),
  instructions: p`Convert the CSV file to a Markdown table.

CSV file contents:
${p.readInput("csvFile")}

1. Use parseCSVRow to parse the header row (first line) and each data row, using "," as delimiter.
2. Build a Markdown table with the header row and all data rows.
3. If input.includeStats is true, append a stats section with row count and column count.
4. Write the complete Markdown to the "markdownTable" output field.
5. Return rowCount (data rows only, not header), columnCount, outputFile (from input), headers (list of column names).`,
  tools: [parseCSVRow],
  output: s.object({
    rowCount: s.int,
    columnCount: s.int,
    outputFile: s.path,
    headers: s.array(s.string),
    markdownTable: s.string,
  }),
  maxTurns: 4,
  addons: repair(),
});

export default csvToMarkdownTable;

```
