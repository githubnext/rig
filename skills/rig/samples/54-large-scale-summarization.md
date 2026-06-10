# 54 - Large-Scale Summarization at Minimum Cost

```rig
import { agent, p, s } from "rig";
// Agent role: summarize one evidence shard cheaply with a small model.
const summarizeShard = agent({ model: "mini", input: s.object({ scenario: s.string, shardLabel: s.string, evidence: s.string }), output: s.object({ shardLabel: s.string, summary: s.string, facts: s.array(s.string) }), instructions: "Summarize only high-signal facts." });
// Agent role: merge shard summaries into one concise final summary.
const reduceScenario = agent({ model: "large", input: s.object({ scenario: s.string, shardSummaries: s.array(s.object({ shardLabel: s.string, summary: s.string, facts: s.array(s.string) })) }), output: s.object({ scenario: s.string, summary: s.string, savings: s.string }), instructions: "Deduplicate facts and keep the final summary short." });
// Agent role: orchestrate deterministic search + parallel shard summarization for nine large-scale scenarios.
const summarizeAtScale = agent({
  model: "large",
  output: s.object({ scenarios: s.array(s.object({ id: s.string, summary: s.string })), costNotes: s.array(s.string) }),
  agents: { summarizeShard, reduceScenario },
  instructions: p`Cover: git diff, 24h repo changes, 24h exported/doc updates, semantic search (query->rg shards->shard summaries->final), plus 24h CI failures, auth/permission changes, dependency risk, API impact, and monorepo owner impact. Use ${p.bash("rg -n \"export|auth|permission|schema\" src docs || true")} and ${p.bash("git log --since='24 hours ago' --name-status --pretty=format:'%h %s'")} first, then parallelize shard work with Promises and use large-model reduction only once per scenario.`,
});
export default summarizeAtScale;
```
