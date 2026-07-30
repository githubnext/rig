import { agent, p, s, defineTool, steering } from "rig";

const extractPatchMetadata = defineTool("extractPatchMetadata", {
  description: "Extract metadata (author, subject, stats) from a git format-patch block.",
  parameters: s.object({ patchBlock: s.string }),
  handler({ patchBlock }) {
    const authorMatch = patchBlock.match(/^From:\s*(.+)$/m);
    const subjectMatch = patchBlock.match(/^Subject:\s*(?:\[PATCH[^\]]*\]\s*)?(.+)$/m);
    const statsMatch = patchBlock.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    return {
      author: authorMatch?.[1]?.trim() ?? "unknown",
      subject: subjectMatch?.[1]?.trim() ?? "unknown",
      filesChanged: statsMatch ? parseInt(statsMatch[1] ?? "0", 10) : 0,
      insertions: statsMatch ? parseInt(statsMatch[2] ?? "0", 10) : 0,
      deletions: statsMatch ? parseInt(statsMatch[3] ?? "0", 10) : 0,
    };
  },
});

// Agent role: summarize git patches from recent commits with author and diffstat info.
const gitPatchSummarizer = agent({
  model: "typecheck",
  addons: steering({ message: "Split the patch output by 'From ' header lines to identify individual patch blocks before calling extractPatchMetadata." }),
  instructions: p`Summarize the most recent git commits as formatted patches.

Recent patches (last 5 commits):
${p.bash("git format-patch -5 --stdout 2>/dev/null | head -300 || echo '(no commits)'")}

Split the output into individual patch blocks (each starts with a 'From ' line).
Call extractPatchMetadata for each block.
Return patches array with author, subject, filesChanged, insertions, deletions.
Set totalPatches to the number of patches found.
Set topContributor to the author with the most patches (omit if all are the same or none found).`,
  tools: [extractPatchMetadata],
  output: s.object({
    patches: s.array(
      s.object({
        author: s.string,
        subject: s.string,
        filesChanged: s.int,
        insertions: s.int,
        deletions: s.int,
      })
    ),
    totalPatches: s.int,
    topContributor: s.optional(s.string),
  }),
});

export default gitPatchSummarizer;
