import { agent, defineTool, p, s, steering } from "rig";

// Agent role: parse server uptime logs to extract start/stop/crash events and compute uptime statistics.
const serverUptimeLogParser = agent({
  model: "typecheck",
  instructions: p`Parse server uptime events from system logs.

System journal / log output:
${p.bash("journalctl -u '*' --no-pager -n 100 2>/dev/null || cat /var/log/syslog 2>/dev/null | tail -100 || echo 'No system logs available'")}

Use the parseLogLine tool to classify each log entry as a start, stop, crash, or restart event. For each event, extract the timestamp and compute duration from the previous stop/start. Flag anomalies (multiple crashes in quick succession) for steering. Return only the declared output.`,
  tools: [
    defineTool("parseLogLine", {
      description: "Classify a log line as a server lifecycle event",
      parameters: s.object({ line: s.string }),
      handler({ line }) {
        const lower = line.toLowerCase();
        if (/start(?:ed|ing)|boot(?:ed|ing)|up\b/.test(lower)) return { event: "start" as const };
        if (/crash(?:ed)?|segfault|oom|killed/.test(lower)) return { event: "crash" as const };
        if (/restart(?:ed|ing)/.test(lower)) return { event: "restart" as const };
        if (/stop(?:ped|ping)|shut(?:down)?|halt(?:ed)?/.test(lower)) return { event: "stop" as const };
        return { event: null };
      },
    }),
  ],
  addons: [
    steering({ message: "If you detect multiple crashes within an hour, flag this as a crash loop anomaly in the output." }),
  ],
  output: s.object({
    uptimeEvents: s.array(s.object({
      event: s.enum("start", "stop", "crash", "restart"),
      timestamp: s.string,
      durationSeconds: s.optional(s.number),
    })),
    crashCount: s.int,
    totalUptimeHours: s.number,
    hasCrashLoop: s.boolean,
  }),
});

export default serverUptimeLogParser;
