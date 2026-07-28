# 279 - Csv To Markdown Table

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseCSVRow = defineTool("parseCSVRow", {
  description: "Split a CSV line into trimmed cell values.",
  parameters: s.object({ line: s.string, delimiter: s.string }),
  handler({ line, delimiter }) {
    return { cells: line.split(delimiter).map((cell: string) => cell.trim()) };
  },
});

// Agent role: convert a CSV file to a Markdown table and write it to an output file.
const csvToMarkdownTable = agent({
  model: "small",
  addons: repair(),
  input: s.object({
    csvFile: s.path,
    outputFile: s.path,
    includeStats: s.boolean,
  }),
  instructions: p`Convert a CSV file to a Markdown table.

CSV file content:
${p.readInput("csvFile")}

1. Call parseCSVRow for the first line with delimiter "," to get the headers.
2. Call parseCSVRow for each subsequent non-empty line to get row cells.
3. Build a Markdown table: header row, separator row (---), then data rows.
4. If input.includeStats is true, append a stats section with row/column counts.
5. Write the complete Markdown output to input.outputFile.
6. Return rowCount (data rows), columnCount, outputFile path, and headers array.`,
  tools: [parseCSVRow],
  output: s.object({
    rowCount: s.int,
    columnCount: s.int,
    outputFile: s.path,
    headers: s.array(s.string),
  }),
});

export default csvToMarkdownTable;
```
