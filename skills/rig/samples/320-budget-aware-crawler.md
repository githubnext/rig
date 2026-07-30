# 320 - Budget-Aware Crawler (log, budget, until)

Demonstrates `log`, `budget`, and `until` — the three Claude dynamic-workflow
primitives most likely to be ported without an obvious rig example. Maps
directly to Claude's `log(message)`, `budget.remaining()`, and open-ended
`while` convergence loops.

See [claude-workflow-conversion.md](../references/claude-workflow-conversion.md)
for the full primitive mapping.

```rig
import { s, workflow } from "rig";

// Workflow role: crawl a starting URL, follow links, and summarise pages while
// the agent budget allows, then return a structured index.
const crawler = workflow({
  meta: {
    name: "crawler",
    description: "Budget-aware web crawler with convergence loop",
    phases: ["Seed", "Crawl"],
    whenToUse: "Summarising an unknown number of pages when agent budget may be limited.",
  },
  input: s.object({ seedUrl: s.url }),
  body: async ({ call, input, log, budget, until, phase }) => {
    phase("Seed");
    log(`Starting crawl from ${input.seedUrl}`);

    const visited = new Set<string>();
    const queue: string[] = [input.seedUrl];

    phase("Crawl");
    const pages: { url: string; summary: string }[] = [];

    await until({ max: 20, noProgressRounds: 3 }, async (_, round) => {
      const url = queue.shift();
      if (!url || visited.has(url)) return { state: pages, done: queue.length === 0, progressKey: `${visited.size}` };

      log(`Round ${round}: crawling ${url} (budget remaining: ${budget.remaining()})`);
      visited.add(url);

      const result = await call.json(
        `Fetch and summarise the page at ${url}. Return a one-sentence summary and up to 3 new links found on the page.`,
        s.object({ summary: s.string, links: s.array(s.url) }),
        { label: url },
      );

      if (result) {
        pages.push({ url, summary: result.summary });
        for (const link of result.links) {
          if (!visited.has(link)) queue.push(link);
        }
      }

      const done = queue.length === 0 || budget.remaining() < 3;
      if (done) log(`Crawl complete: ${pages.length} pages, ${queue.length} links remaining`);
      return { state: pages, done, progressKey: `${visited.size}` };
    });

    return pages;
  },
});

export default crawler;
```
