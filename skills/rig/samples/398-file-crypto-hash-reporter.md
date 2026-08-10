# 398 - File Crypto Hash Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Agent role: compute cryptographic hashes for all files in a target directory
// and report sizes.
const fileCryptoHashReporter = agent({
  model: "small",
  input: s.object({ targetDir: s.string, algorithm: s.optional(s.string) }),
  instructions: p`Compute file hashes for all files in targetDir.
Files found: ${p.glob("**/*")}
For each file path call computeFileHash. Return declared output with files record and algorithm used.`,
  tools: [
    defineTool("computeFileHash", {
      description: "Compute the cryptographic hash and size of a file",
      parameters: s.object({ filePath: s.path, algorithm: s.string }),
      async handler({ filePath, algorithm }) {
        const buf = await readFile(filePath);
        const hash = createHash(algorithm).update(buf).digest("hex");
        return { hash, sizeBytes: buf.length, algorithm };
      },
    }),
  ],
  output: s.object({
    files: s.record(s.object({
      hash: s.string,
      sizeBytes: s.int,
      algorithm: s.string,
    })),
    totalFiles: s.int,
    algorithm: s.string,
  }),
  addons: [repair()],
});

export default fileCryptoHashReporter;
```
