# 468 - File Crypto Hash Reporter

```rig
import { agent, defineTool, p, s, steering } from "rig";


const hashFile = defineTool("hashFile", {
  description: "Compute SHA-256 hash of a file using node:crypto.",
  parameters: s.object({ filePath: s.path("File to hash") }),
  async handler({ filePath }) {
    const { readFile } = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    try {
      const buf = await readFile(filePath);
      const hash = createHash("sha256").update(buf).digest("hex");
      const sizeBytes = buf.length;
      return JSON.stringify({ hash, sizeBytes });
    } catch {
      return JSON.stringify({ error: "could not read file" });
    }
  },
});

// Agent role: compute SHA-256 hashes and sizes for key project files and report integrity status.
const fileCryptoHashReporter = agent({
  name: "fileCryptoHashReporter",
  model: "small",
  instructions: p`Find key project files to hash for integrity checking.
${p.bash("find . -maxdepth 2 -name 'package.json' -o -name 'package-lock.json' -o -name 'tsconfig.json' -o -name '.npmrc' 2>/dev/null | grep -v node_modules | head -10")}
Use hashFile on each file path. Return a hashes record keyed by filePath with hash and sizeBytes, totalFiles, and largestFile path.`,
  output: s.object({
    hashes: s.record(s.object({ hash: s.string, sizeBytes: s.int })),
    totalFiles: s.int,
    largestFile: s.optional(s.path),
  }),
  tools: [hashFile],
  addons: [steering()],
});

export default fileCryptoHashReporter;
```
