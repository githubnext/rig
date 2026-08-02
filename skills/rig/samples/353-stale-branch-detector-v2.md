# 353 - Stale Branch Detector V2

```rig
import { agent, p, s, defineTool, repair } from "rig";

const classifyBranchAge = defineTool("classifyBranchAge", {
  description: "Classify a git branch as fresh, stale, or dead based on its last commit date.",
  parameters: { branchName: s.string, lastCommitDate: s.string },
  handler: ({ lastCommitDate }: { branchName: string; lastCommitDate: string }) => {
    const ageMs = Date.now() - new Date(lastCommitDate).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 30) return "fresh" as const;
    if (ageDays < 90) return "stale" as const;
    return "dead" as const;
  },
});

// Agent role: detect stale and dead local git branches and recommend candidates for deletion.
const staleBranchDetector = agent({
  model: "small",
  instructions: p`Detect stale and dead local git branches.

Branch list with last commit dates:
${p.bash("git for-each-ref --format='%(refname:short)|%(committerdate:iso8601)' refs/heads 2>/dev/null || echo ''")}

Steps:
1. Parse each line as "branchName|lastCommitDate".
2. For each branch, call classifyBranchAge to get its classification.
3. Build the branches array with name, lastCommit, and classification fields.
4. Count staleCount (classification = "stale") and deadCount (classification = "dead").
5. Set recommendedForDeletion to the names of branches where classification is "dead".`,
  output: s.object({
    branches: s.array(s.object({
      name: s.string,
      lastCommit: s.string,
      classification: s.enum("fresh", "stale", "dead"),
    })),
    staleCount: s.int,
    deadCount: s.int,
    recommendedForDeletion: s.array(s.string),
  }),
  tools: [classifyBranchAge],
  maxTurns: 6,
  addons: [repair()],
});

export default staleBranchDetector;

```
