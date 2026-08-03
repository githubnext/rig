# 361 - Stale Branch Detector V3

```rig
import { agent, p, s, defineTool } from "rig";

const classifyBranchAge = defineTool("classifyBranchAge", {
  description: "Classify a branch as fresh, stale, or dead based on its Unix commit timestamp.",
  parameters: s.object({ name: s.string, unixTimestamp: s.int }),
  handler: ({ unixTimestamp }: { name: string; unixTimestamp: number }) => {
    const ageDays = (Date.now() / 1000 - unixTimestamp) / 86400;
    if (ageDays < 30) return "fresh" as const;
    if (ageDays < 90) return "stale" as const;
    return "dead" as const;
  },
});

// Agent role: detect stale and dead local git branches and recommend candidates for deletion.
const staleBranchDetector = agent({
  model: "small",
  instructions: p`Detect stale and dead local git branches.

Branch list (format: name|unix-timestamp):
${p.bash("git for-each-ref --format='%(refname:short)|%(committerdate:unix)' refs/heads 2>/dev/null || echo ''")}

Steps:
1. Parse each line as name|unixTimestamp.
2. For each branch call classifyBranchAge with the parsed values.
3. Build the branches array with name, lastCommit (ISO string from timestamp), and ageClass.
4. Count staleCount (ageClass="stale") and deadCount (ageClass="dead").
5. Set recommendedForDeletion to names where ageClass is "dead".`,
  output: s.object({
    branches: s.array(s.object({
      name: s.string,
      lastCommit: s.string,
      ageClass: s.enum("fresh", "stale", "dead"),
    })),
    staleCount: s.number,
    deadCount: s.number,
    recommendedForDeletion: s.array(s.string),
  }),
  tools: [classifyBranchAge],
  maxTurns: 6,
});

export default staleBranchDetector;
```
