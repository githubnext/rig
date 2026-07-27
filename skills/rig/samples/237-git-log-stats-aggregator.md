# 237 - Git Log Stats Aggregator

```rig
import { agent, p, s, defineTool } from "rig";

const aggregateStats = defineTool("aggregateStats", {
  description: "Aggregate git log lines into per-author and per-day-of-week commit counts.",
  parameters: { logLines: s.string },
  handler: ({ logLines }) => {
    const perAuthor: Record<string, number> = {};
    const perDayOfWeek: Record<string, number> = {};
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let totalCommits = 0;
    for (const line of logLines.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("|");
      if (parts.length < 4) continue;
      const author = parts[1].trim();
      const dateStr = parts[3].trim();
      perAuthor[author] = (perAuthor[author] ?? 0) + 1;
      const day = days[new Date(dateStr).getDay()];
      if (day) perDayOfWeek[day] = (perDayOfWeek[day] ?? 0) + 1;
      totalCommits++;
    }
    const mostActiveAuthor = Object.entries(perAuthor).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const mostActiveDay = Object.entries(perDayOfWeek).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { perAuthor, perDayOfWeek, totalCommits, mostActiveAuthor, mostActiveDay };
  },
});

// Agent role: aggregate git log statistics into per-author and per-day-of-week commit counts.
const gitLogStatsAggregator = agent({
  model: "small",
  instructions: p`Aggregate git commit statistics from the following log:

${p.bash("git log --format='%H|%an|%ae|%ad|%s' --date=short -100 2>/dev/null || echo ''")}

Call aggregateStats with the full log text above as logLines.
Return the result including perAuthor counts, perDayOfWeek counts, totalCommits,
mostActiveAuthor, and mostActiveDay.`,
  output: s.object({
    perAuthor: s.record(s.int),
    perDayOfWeek: s.record(s.int),
    totalCommits: s.int,
    mostActiveAuthor: s.optional(s.string),
    mostActiveDay: s.optional(s.string),
  }),
  tools: [aggregateStats],
});

export default gitLogStatsAggregator;
```
