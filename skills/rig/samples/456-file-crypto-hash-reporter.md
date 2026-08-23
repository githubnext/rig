# 456 - File Crypto Hash Reporter

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const computeFileHash = defineTool("computeFileHash", {
  description: "Compute a cryptographic hash of a file",
  parameters: s.object({ filePath: s.path, algorithm: s.optional(s.string) }),
  handler: async ({ filePath, algorithm = "sha256" }: { filePath: string; algorithm?: string }) => {
    const buf = await readFile(filePath);
    const hash = createHash(algorithm).update(buf).digest("hex");
    return { hash, sizeBytes: buf.length, algorithm };
  },
});

// Agent role: Compute cryptographic hashes for all files in targetDir.
const fileCryptoHashReporter = agent({
  model: "small",
  input: s.object({ targetDir: s.string, algorithm: s.optional(s.string) }),
  instructions: p`Find files to hash in the workspace: ${p.glob("**/*")}. For each file, call computeFileHash. Use the algorithm from input if provided (default sha256). Return the result.`,
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
