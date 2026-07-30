import { agent, p, s, defineTool, steering, repair } from "rig";

const parseUptimeEvent = defineTool("parseUptimeEvent", {
  description: "Parse a log line to extract uptime lifecycle events",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const startedMatch = line.match(/(\S+\s+\S+\s+\S+).*\s(\S+(?:\[\d+\])?): .*[Ss]tarted/);
    const stoppedMatch = line.match(/(\S+\s+\S+\s+\S+).*\s(\S+(?:\[\d+\])?): .*[Ss]topped/);
    const crashMatch = line.match(/(\S+\s+\S+\s+\S+).*\s(\S+(?:\[\d+\])?): .*(?:[Cc]rash|[Kk]ill|exit.*code [^0])/);
    if (crashMatch) return { timestamp: crashMatch[1] ?? "", service: crashMatch[2] ?? "", event: "crashed" as const };
    if (startedMatch) return { timestamp: startedMatch[1] ?? "", service: startedMatch[2] ?? "", event: "started" as const };
    if (stoppedMatch) return { timestamp: stoppedMatch[1] ?? "", service: stoppedMatch[2] ?? "", event: "stopped" as const };
    return { timestamp: "", service: "", event: "unknown" as const };
  },
});

// Agent role: Parse system logs to identify service lifecycle events, crash counts, and uptime statistics.
const uptimeLogParser = agent({
  model: "typecheck",
  instructions: p`Analyze the following system log lines to identify service lifecycle events.
Log lines:
${p.bash("journalctl -n 200 --no-pager 2>/dev/null || tail -n 200 /var/log/syslog 2>/dev/null || echo 'no logs'")}

Use the parseUptimeEvent tool on relevant log lines that mention service starts, stops, or crashes.
Calculate totalUptimeHours as a rough estimate based on timestamps found.
Set hasCrashLoop to true if crashCount >= 3.
Return the structured output.`,
  output: s.object({
    uptimeEvents: s.array(s.object({
      timestamp: s.string,
      service: s.string,
      event: s.enum("started", "stopped", "crashed", "unknown"),
    })),
    crashCount: s.int,
    totalUptimeHours: s.number,
    hasCrashLoop: s.boolean,
  }),
  tools: [parseUptimeEvent],
  addons: [steering(), repair()],
});

export default uptimeLogParser;
