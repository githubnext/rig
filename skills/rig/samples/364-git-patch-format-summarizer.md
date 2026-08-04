# 364 - Git Patch Format Summarizer

```rig
import { agent, p, s, defineTool } from "rig";
import { steering } from "rig";

const extractPatchMetadata = defineTool("extractPatchMetadata", {
  description: "Parse a git patch block and extract author, subject, files changed, insertions, and deletions.",
  parameters: { patch: s.string },
  handler: ({ patch }: { patch: string }) => {
    const author = (patch.match(/^From: (.+)$/m) ?? [])[1]?.trim() ?? "unknown";
    const subject = (patch.match(/^Subject: (.+)$/m) ?? [])[1]?.replace(/^\[PATCH[^\]]*\] /, "").trim() ?? "unknown";
    const filesChanged = parseInt((patch.match(/(\d+) file[s]? changed/) ?? [])[1] ?? "0", 10);
    const insertions = parseInt((patch.match(/(\d+) insertion/) ?? [])[1] ?? "0", 10);
    const deletions = parseInt((patch.match(/(\d+) deletion/) ?? [])[1] ?? "0", 10);
    return { author, subject, filesChanged, insertions, deletions };
  },
});

const gitPatchFormatSummarizer = agent({
  model: "small",
  instructions: p`Summarize the last 5 git commits as patch metadata.

Patch output:
${p.bash("git format-patch -5 --stdout 2>/dev/null | head -500 || echo 'no patches'")}

Steps:
1. Split the patch output into individual patch blocks (each starts with "From <hash>").
2. For each patch block, call extractPatchMetadata to get author, subject, filesChanged, insertions, deletions.
3. Build patches array from results.
4. totalPatches = patches.length.
5. topContributor = author name that appears most frequently (omit if no patches).`,
  output: s.object({
    patches: s.array(
      s.object({
        author: s.string,
        subject: s.string,
        filesChanged: s.number,
        insertions: s.number,
        deletions: s.number,
      })
    ),
    totalPatches: s.number,
    topContributor: s.optional(s.string),
  }),
  tools: [extractPatchMetadata],
  addons: [steering()],
});

export default gitPatchFormatSummarizer;
```
