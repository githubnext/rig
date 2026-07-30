import { agent, p, s, defineTool, steering } from "rig";
import { execSync } from "node:child_process";

const getFileOwner = defineTool("getFileOwner", {
  description: "Get git ownership info for a file path",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    try {
      const output = execSync(`git log --format="%ae" -- "${filePath}" 2>/dev/null`, { encoding: "utf8" });
      const emails = output.trim().split("\n").filter((e: string) => e.length > 0);
      const counts: Record<string, number> = {};
      for (const email of emails) {
        counts[email] = (counts[email] ?? 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
      const primaryOwner = sorted[0]?.[0] ?? "unknown";
      const commitCount = emails.length;
      const contributors = sorted.map((e: [string, number]) => e[0]);
      return { primaryOwner, commitCount, contributors };
    } catch {
      return { primaryOwner: "unknown", commitCount: 0, contributors: [] };
    }
  },
});

// Agent role: map git file ownership by analyzing commit history for TypeScript files
const gitFileOwnershipMapper = agent({
  model: "typecheck",
  instructions: p`Discover TypeScript source files: ${p.glob("src/**/*.ts")}

Use the getFileOwner tool for each discovered file path to collect ownership data. Build a complete ownership record and identify the mostActiveContributor across all files.`,
  output: s.object({
    ownership: s.record(s.object({
      primaryOwner: s.string,
      commitCount: s.int,
      contributors: s.array(s.string),
    })),
    mostActiveContributor: s.string,
  }),
  tools: [getFileOwner],
  addons: [steering()],
});

export default gitFileOwnershipMapper;
