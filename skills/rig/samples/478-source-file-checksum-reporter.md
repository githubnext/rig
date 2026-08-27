# 478 - Source File Checksum Reporter

```rig
import { agent, defineTool, p, s, steering, repair } from "rig";

const computeChecksum = defineTool("computeChecksum", {
  description: "Compute the MD5 checksum and byte size of a file.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }) => {
    const { createHash } = await import("node:crypto");
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(filePath);
    const checksum = createHash("md5").update(buf).digest("hex");
    return { checksum, sizeBytes: buf.length };
  },
});

// Agent role: compute MD5 checksums for all TypeScript source files and report totals.
const sourceFileChecksumReporter = agent({
  model: "small",
  instructions: p`Find TypeScript source files with ${p.bash("find src -name '*.ts' -not -path '*/node_modules/*' 2>/dev/null | head -50 || echo ''")}. For each file path, call computeChecksum. Return files as a record keyed by path with checksum and sizeBytes, plus totalFiles, totalBytes, and largestFile (the path with the most bytes, or omit if none).`,
  output: s.object({
    files: s.record(s.object({ checksum: s.string, sizeBytes: s.int })),
    totalFiles: s.int,
    totalBytes: s.int,
    largestFile: s.optional(s.string),
  }),
  tools: [computeChecksum],
  maxTurns: 8,
  addons: [steering(), repair()],
});

export default sourceFileChecksumReporter;
```
