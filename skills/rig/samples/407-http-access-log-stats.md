# 407 - Http Access Log Stats

```rig
import { agent, p, s, repair, defineTool } from "rig";

const parseLogLine = defineTool("parseLogLine", {
  description: "Parse a single combined log format HTTP access log line and classify the status code.",
  parameters: s.object({ line: s.string }),
  handler: ({ line }: { line: string }) => {
    const m = line.match(/^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\w+)\s+(\S+)\s+\S+"\s+(\d+)/);
    if (!m) return { path: "", statusCode: 0, statusClass: "other" as const };
    const statusCode = parseInt(m[5], 10);
    const statusClass =
      statusCode >= 200 && statusCode < 300 ? "2xx" as const :
      statusCode >= 300 && statusCode < 400 ? "3xx" as const :
      statusCode >= 400 && statusCode < 500 ? "4xx" as const :
      statusCode >= 500 ? "5xx" as const : "other" as const;
    return { path: m[4], statusCode, statusClass };
  },
});

// Agent role: Parse an HTTP access log file and return status count statistics.
const httpAccessLogStats = agent({
  model: "small",
  input: s.object({ logFile: s.path }),
  instructions: p`Access log contents:
${p.readInput("logFile")}

For each line in the log, use the parseLogLine tool to extract the path and status class. Aggregate into statusCounts (record of status class to count), topPaths (up to 10 most frequent paths), totalRequests, and errorRate (fraction of 4xx+5xx requests as a number between 0 and 1).`,
  tools: [parseLogLine],
  output: s.object({
    statusCounts: s.record(s.int),
    topPaths: s.array(s.string),
    totalRequests: s.int,
    errorRate: s.number,
  }),
  addons: [repair()],
});

export default httpAccessLogStats;
```
