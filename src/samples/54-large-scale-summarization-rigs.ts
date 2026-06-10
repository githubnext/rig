import { agent, p, s } from "rig";

const LARGE = "large";
const MINI = "mini";
const NANO = "nano";

// Agent role: summarize a bounded evidence shard using a small, low-cost model.
const summarizeShard = agent({
  model: MINI,
  input: s.object({
    scenario: s.string,
    shardLabel: s.string,
    evidence: s.string,
  }),
  output: s.object({
    shardLabel: s.string,
    summary: s.string,
    facts: s.array(s.string),
  }),
  instructions: "Summarize only essential facts. Keep output concise and deduplicated.",
});

// Agent role: combine shard summaries into one final scenario summary.
const reduceScenario = agent({
  model: LARGE,
  input: s.object({
    scenario: s.string,
    shardSummaries: s.array(s.object({
      shardLabel: s.string,
      summary: s.string,
      facts: s.array(s.string),
    })),
  }),
  output: s.object({
    scenario: s.string,
    summary: s.string,
    keyFindings: s.array(s.string),
    estimatedTokenSavings: s.string,
  }),
  instructions: "Merge shard summaries into a single concise answer with no repeated facts.",
});

// Agent role: generate deterministic search patterns before any model-heavy summarization.
const planDeterministicSearch = agent({
  model: NANO,
  input: s.object({
    query: s.string,
  }),
  output: s.object({
    grepPatterns: s.array(s.string),
    includeGlobs: s.array(s.string),
  }),
  instructions: "Create high precision grep/rg patterns to minimize scanned text.",
});

// Agent role: orchestrate large-scale summarization scenarios with map/reduce and parallel fan-out.
const summarizeAtScale = agent({
  model: LARGE,
  input: s.object({
    text: s.string,
  }),
  output: s.object({
    scenarios: s.array(s.object({
      id: s.string,
      summary: s.string,
      keyFindings: s.array(s.string),
      estimatedTokenSavings: s.string,
    })),
    searchPlan: s.object({
      grepPatterns: s.array(s.string),
      includeGlobs: s.array(s.string),
    }),
  }),
  agents: { summarizeShard, reduceScenario, planDeterministicSearch },
  instructions: p`Build cost-efficient summaries for these large-scale scenarios:
- summarize a git diff
- summarize 24h of changes in a repo
- summarize exported changes in 24h of commits to update docs
- efficient semantic search of a codebase (query -> grep shards -> shard summaries -> final summary)
- summarize 24h of CI failures grouped by root cause
- summarize 24h of security-relevant auth and permission changes
- summarize 24h of dependency and lockfile changes by risk
- summarize 24h of API surface changes by consumer impact
- summarize 24h of cross-package monorepo changes by owner area

Use deterministic evidence collection first, then parallel Promise fan-out with small models, and finish with one large-model reducer only when needed.
Use evidence such as ${p.bash("git diff -- .")} and ${p.bash("git log --since='24 hours ago' --name-status --pretty=format:'%h %s'")} and ${p.bash("git log --since='24 hours ago' -- src '*.md' '*.ts' '*.js' --name-only --pretty=format:'%h %s' || true")}.`,
});

const searchPlanPromise = planDeterministicSearch({
  query: "Where did auth, exports, and schema behavior change in the last 24h?",
});

const [diffShard, commitsShard, docsShard, searchPlan] = await Promise.all([
  summarizeShard({
    scenario: "git-diff-summary",
    shardLabel: "diff",
    evidence: p.bash("git diff -- ."),
  }),
  summarizeShard({
    scenario: "repo-24h-summary",
    shardLabel: "commits-24h",
    evidence: p.bash("git log --since='24 hours ago' --name-status --pretty=format:'%h %s'"),
  }),
  summarizeShard({
    scenario: "docs-exported-changes-24h",
    shardLabel: "exports-and-docs",
    evidence: p.bash("git log --since='24 hours ago' -- 'src/**' 'docs/**' --name-only --pretty=format:'%h %s' || true"),
  }),
  searchPlanPromise,
]);

const semanticSearchShard = await summarizeShard({
  scenario: "semantic-search-pipeline",
  shardLabel: "search-plan",
  evidence: JSON.stringify(searchPlan),
});

await reduceScenario({
  scenario: "core-scenarios",
  shardSummaries: [diffShard, commitsShard, docsShard, semanticSearchShard],
});

await summarizeAtScale({ text: p`` });

export default summarizeAtScale;
