# 446 - File Crypto Hash Reporter

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { repair } from "rig";

const computeFileHash = defineTool("computeFileHash", {
  description: "Compute the cryptographic hash of a file",
  parameters: s.object({ filePath: s.path, algorithm: s.string }),
  handler: async ({ filePath, algorithm }: { filePath: string; algorithm: string }) => {
    const data = await readFile(filePath);
    const hash = createHash(algorithm).update(data).digest("hex");
    const info = await stat(filePath);
    return { hash, sizeBytes: info.size, algorithm };
  },
});

// Agent role: Compute cryptographic hashes for all files in a target directory.
const fileCryptoHashReporter = agent({
  model: "small",
  input: s.object({ targetDir: s.string, algorithm: s.optional(s.string) }),
  instructions: p`You have these files: ${p.glob("**/*")}.
For each file, call computeFileHash using the provided algorithm (default: sha256).
Return per-file hash, size, and algorithm info, plus totals.`,
  output: s.object({
    files: s.record(s.object({
      hash: s.string,
      sizeBytes: s.int,
      algorithm: s.string,
    })),
    totalFiles: s.int,
    algorithm: s.string,
  }),
  tools: [computeFileHash],
  addons: [repair()],
});

export default fileCryptoHashReporter;
```
