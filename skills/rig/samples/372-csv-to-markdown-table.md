# 372 - Csv To Markdown Table

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseCSVRow = defineTool("parseCSVRow", {
  description: "Parse a single CSV row into an array of trimmed string values.",
  parameters: s.object({ row: s.string }),
  handler({ row }) {
    return row.split(",").map((cell: string) => cell.trim());
  },
});

// Agent role: Convert a CSV file to a Markdown table and write it to the output file.
const csvToMarkdownTable = agent({
  model: "small",
  input: s.object({ csvFile: s.path, outputFile: s.path, includeStats: s.boolean }),
  instructions: p`Read ${p.readInput("csvFile")}, parse each row using parseCSVRow, format as a Markdown table, and write to ${p.writeInput("outputFile", "markdownContent")}. If includeStats is true, append row and column statistics.`,
  output: s.object({
    rowCount: s.int,
    columnCount: s.int,
    outputFile: s.path,
    headers: s.array(s.string),
  }),
  tools: [parseCSVRow],
  addons: [repair()],
});

export default csvToMarkdownTable;
```
