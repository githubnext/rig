# 246 - Stale Branch Detector

```rig
import { agent, p, s, defineTool } from "rig";

const classifyBranchAge = defineTool("classifyBranchAge", {
  description: "Classify a branch as fresh, stale, or dead based on its last commit date.",
  parameters: { branchName: s.string, lastCommitDate: s.string },
  handler: ({ lastCommitDate }: { branchName: string; lastCommitDate: string }) => {
    const ageMs = Date.now() - new Date(lastCommitDate).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 30) return "fresh";
    if (ageDays < 90) return "stale";
    return "dead";
  },
});

// Agent role: detect stale and dead local git branches and recommend candidates for deletion.
const staleBranchDetector = agent({
  model: "small",
  instructions: p`Detect stale and dead local git branches.

Branch list with last commit dates:
${p.bash("git for-each-ref --format='%(refname:short)|%(committerdate:iso8601)' refs/heads 2>/dev/null || echo ''")}

Steps:
1. Parse each line as branchName|lastCommitDate.
2. For each branch, call classifyBranchAge to get its age category.
3. Build the branches array with name, lastCommit, and age.
4. Count staleCount (age = "stale") and deadCount (age = "dead").
5. Set recommendedForDeletion to branch names where age is "dead".`,
  output: s.object({
    branches: s.array(s.object({
      name: s.string,
      lastCommit: s.string,
      age: s.enum("fresh", "stale", "dead"),
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
