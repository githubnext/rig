# 257 - Binary File Detector

```rig
import { agent, p, s, defineTool, steering } from "rig";

const detectBinary = defineTool("detectBinary", {
  description: "Detect whether a file is binary by sampling its first 8KB for null bytes",
  parameters: s.object({ filePath: s.string }),
  handler: async ({ filePath }) => {
    const { readFile, stat } = await import("node:fs/promises");
    try {
      const stats = await stat(filePath);
      const sizeBytes = stats.size;
      const buf = await readFile(filePath);
      const sample = buf.slice(0, 8192);
      let nullBytes = 0;
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) nullBytes++;
      }
      const nullRatio = sample.length > 0 ? nullBytes / sample.length : 0;
      const type = nullRatio > 0.01 ? "binary" : "text";
      return JSON.stringify({ type, sizeBytes });
    } catch {
      return JSON.stringify({ type: "unknown", sizeBytes: 0 });
    }
  },
});

// Agent role: detect binary files committed to the git repository by sampling file contents
const binaryFileDetector = agent({
  name: "binaryFileDetector",
  model: "small",
  addons: steering(),
  tools: [detectBinary],
  instructions: p`Detect binary files in the git repository.

All tracked files: ${p.bash("git ls-files 2>/dev/null | head -200")}

For each tracked file, call detectBinary to classify it as text, binary, or unknown.
Count binaryCount and textCount across all files.
Set hasBinaryFiles to true if binaryCount > 0.
Return a record keyed by file path.`,
  output: s.object({
    files: s.record(
      s.object({
        type: s.enum("text", "binary", "unknown"),
        sizeBytes: s.optional(s.int),
      })
    ),
    binaryCount: s.int,
    textCount: s.int,
    hasBinaryFiles: s.boolean,
  }),
});

export default binaryFileDetector;
```
