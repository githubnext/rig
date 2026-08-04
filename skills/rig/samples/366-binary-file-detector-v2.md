# 366 - Binary File Detector V2

```rig
import { agent, p, s, defineTool } from "rig";
import { open } from "node:fs/promises";
import { stat } from "node:fs/promises";

const detectBinaryFile = defineTool("detectBinaryFile", {
  description: "Detect if a file is binary by sampling the first 8KB for null bytes.",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    try {
      const stats = await stat(filePath);
      const sizeBytes = stats.size;
      const fh = await open(filePath, "r");
      try {
        const buf = Buffer.alloc(Math.min(8192, sizeBytes));
        await fh.read(buf, 0, buf.length, 0);
        const hasNull = buf.includes(0);
        return { type: (hasNull ? "binary" : "text") as "binary" | "text", sizeBytes };
      } finally {
        await fh.close();
      }
    } catch {
      return { type: "unknown" as const, sizeBytes: 0 };
    }
  },
});

// Agent role: detect binary files among git-tracked files by sampling file contents.
const binaryFileDetector = agent({
  model: "small",
  instructions: p`Detect binary files among git-tracked files.

Git-tracked files:
${p.bash("git ls-files 2>/dev/null | head -200 || echo ''")}

Steps:
1. For each file path, call detectBinaryFile.
2. Build files as a record keyed by file path with type and sizeBytes.
3. Count binaryCount (type="binary") and textCount (type="text").
4. Set hasBinaryFiles = binaryCount > 0.`,
  output: s.object({
    files: s.record(s.object({
      type: s.enum("text", "binary", "unknown"),
      sizeBytes: s.number,
    })),
    binaryCount: s.number,
    textCount: s.number,
    hasBinaryFiles: s.boolean,
  }),
  tools: [detectBinaryFile],
  maxTurns: 8,
});

export default binaryFileDetector;
```
