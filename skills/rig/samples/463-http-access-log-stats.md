# 463 - HTTP Access Log Stats

```rig
import { agent, defineTool, p, repair, s } from "rig";


const parseLogLine = defineTool("parseLogLine", {
  description: "Parse a single HTTP access log line and classify its HTTP status.",
  parameters: s.object({ line: s.string("Raw access log line") }),
  handler({ line }) {
    const parts = line.split(" ");
    const statusStr = parts.find((p: string) => /^\d{3}$/.test(p)) ?? "0";
    const status = parseInt(statusStr, 10);
    let statusClass: "2xx" | "3xx" | "4xx" | "5xx" | "other";
    if (status >= 200 && status < 300) statusClass = "2xx";
    else if (status >= 300 && status < 400) statusClass = "3xx";
    else if (status >= 400 && status < 500) statusClass = "4xx";
    else if (status >= 500 && status < 600) statusClass = "5xx";
    else statusClass = "other";
    const pathMatch = line.match(/"(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s"]+)/);
    const path = pathMatch ? pathMatch[1] : "/";
    return JSON.stringify({ status, statusClass, path });
  },
});

// Agent role: parse an HTTP access log file and compute request statistics.
const httpAccessLogStats = agent({
  name: "httpAccessLogStats",
  model: "small",
  input: s.object({ logFile: s.path("Path to HTTP access log file") }),
  instructions: p`Read the HTTP access log at the specified path using ${p.readInput("logFile")}.
Use parseLogLine on each non-empty line to classify its status. Aggregate:
- statusCounts: count per status class (2xx, 3xx, 4xx, 5xx, other)
- topPaths: top 5 most frequent request paths
- totalRequests: total line count
- errorRate: (4xx + 5xx) / total as a fraction 0-1`,
  output: s.object({
    statusCounts: s.record(s.int),
    topPaths: s.array(s.string),
    totalRequests: s.int,
    errorRate: s.number,
  }),
  tools: [parseLogLine],
  addons: [repair()],
});

export default httpAccessLogStats;
```
