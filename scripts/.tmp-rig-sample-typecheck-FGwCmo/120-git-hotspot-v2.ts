import { agent, p, s, defineTool, repair } from "rig";

const getFileCommitCount = defineTool("getFileCommitCount", {
  description: "Count how many commits touched a specific file",
  parameters: s.object({ file: s.string }),
  handler: async ({ file }) => {
    const { execSync } = await import("node:child_process");
    try {
      const result = execSync(`git log --follow --oneline -- "${file}" 2>/dev/null | wc -l`, { encoding: "utf8" });
      return result.trim();
    } catch {
      return "0";
    }
  },
});

// Agent role: analyze git history to identify hot-spot files by commit frequency and contributor count
const gitHotspotAnalyzer = agent({
  name: "gitHotspotAnalyzer",
  model: "typecheck",
  maxTurns: 3,
  addons: repair(),
  instructions: p`Analyze the git history to identify file hot-spots.

Changed files: ${p.bash("git log --follow --name-only --format='' -- . 2>/dev/null | sort | uniq -c | sort -rn | head -30")}

Contributors: ${p.bash("git shortlog -sn --no-merges 2>/dev/null | head -10")}

Use the getFileCommitCount tool to look up commit counts for the top files.
For each file, determine its hotspot level based on commit count:
- critical: 50+ commits
- high: 20–49 commits
- medium: 5–19 commits
- low: fewer than 5 commits

Return a record keyed by file path with commitCount, topContributors array, and hotspotLevel.`,
  output: s.record(
    s.object({
      commitCount: s.int,
      topContributors: s.array(s.string),
      hotspotLevel: s.enum("low", "medium", "high", "critical"),
    })
  ),
  tools: [getFileCommitCount],
});

export default gitHotspotAnalyzer;
