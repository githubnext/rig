# 371 - Git File Ownership Mapper

```rig
import { agent, p, s, defineTool, steering } from "rig";
import { execSync } from "node:child_process";

const getFileOwner = defineTool("getFileOwner", {
  description: "Get git commit history for a file and return ownership info.",
  parameters: { filePath: s.path },
  handler: ({ filePath }: { filePath: string }) => {
    try {
      const output = execSync(`git log --format="%ae" -- "${filePath}" 2>/dev/null`, { encoding: "utf-8" }).trim();
      const emails = output ? output.split("\n").filter(Boolean) : [];
      const counts: Record<string, number> = {};
      for (const email of emails) counts[email] = (counts[email] ?? 0) + 1;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const primaryOwner = sorted[0]?.[0] ?? "unknown";
      const commitCount = emails.length;
      const contributors = sorted.map(([email]) => email);
      return { primaryOwner, commitCount, contributors };
    } catch {
      return { primaryOwner: "unknown", commitCount: 0, contributors: [] };
    }
  },
});

// Agent role: map git file ownership for all TypeScript source files.
const gitFileOwnershipMapper = agent({
  model: "small",
  instructions: p`Map git file ownership for TypeScript source files.

Source files:
${p.glob("src/**/*.ts")}

Steps:
1. For each file path listed above, call getFileOwner to retrieve primaryOwner, commitCount, contributors.
2. Build ownership record keyed by file path.
3. Find mostActiveContributor: the email with the highest total commit count across all files.`,
  output: s.object({
    ownership: s.record(
      s.object({
        primaryOwner: s.string,
        commitCount: s.int,
        contributors: s.array(s.string),
      })
    ),
    mostActiveContributor: s.string,
  }),
  tools: [getFileOwner],
  addons: [steering()],
});

export default gitFileOwnershipMapper;
```
