# 438 - Markdown Table Writer

```rig
import { agent, p, s, defineTool } from "rig";

const convertCsvToMarkdown = defineTool("convertCsvToMarkdown", {
  description: "Convert CSV text to a Markdown table string.",
  parameters: s.object({ csv: s.string }),
  handler({ csv }: { csv: string }) {
    const rows = csv.split("\n").map((r: string) => r.split(",").map((c: string) => c.trim())).filter((r: string[]) => r.some((c: string) => c.length > 0));
    if (rows.length === 0) return { markdown: "", rowCount: 0, columnCount: 0, headers: [] };
    const [header, ...data] = rows;
    const sep = header.map(() => "---").join(" | ");
    const lines = [
      `| ${header.join(" | ")} |`,
      `| ${sep} |`,
      ...data.map((row: string[]) => `| ${row.join(" | ")} |`),
    ];
    return { markdown: lines.join("\n"), rowCount: data.length, columnCount: header.length, headers: header };
  },
});

// Agent role: convert a CSV file to a Markdown table and write the result to an output file.
const markdownTableWriter = agent({
  model: "small",
  input: s.object({ csvFile: s.path, outputFile: s.path }),
  instructions: p`Convert a CSV file to a Markdown table and write it to the output file.

CSV file contents:
${p.readInput("csvFile")}

1. Call convertCsvToMarkdown with the CSV content.
2. The markdownTable field in the output should contain the generated Markdown.
3. Use the outputFile path value provided as input for the outputFile output field.
4. Set rowCount, columnCount, and headers from the tool result.`,
  tools: [convertCsvToMarkdown],
  output: s.object({
    markdownTable: s.string,
    rowCount: s.int,
    columnCount: s.int,
    headers: s.array(s.string),
    outputFile: s.path,
  }),
});

export default markdownTableWriter;
```
