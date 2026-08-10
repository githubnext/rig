# 397 - Zlib Compression Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// Agent role: measure zlib compression ratio for each file in a target directory
// and classify compressibility.
const zlibCompressionAnalyzer = agent({
  model: "small",
  input: s.object({ targetDir: s.string }),
  instructions: p`Find files in the targetDir from input and measure their compression ratios.
Sample files: ${p.bash("find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -20")}
For each file in the targetDir call measureCompressionRatio. Return declared output.`,
  tools: [
    defineTool("measureCompressionRatio", {
      description: "Measure the zlib deflate compression ratio of a file",
      parameters: s.object({ filePath: s.path }),
      async handler({ filePath }) {
        const buf = await readFile(filePath);
        const originalBytes = buf.length;
        if (originalBytes === 0) return { originalBytes: 0, compressedBytes: 0, ratio: 1, compressionClass: "incompressible" as const };
        const compressed = deflateSync(buf);
        const compressedBytes = compressed.length;
        const ratio = compressedBytes / originalBytes;
        let compressionClass: "excellent" | "good" | "poor" | "incompressible";
        if (ratio < 0.3) compressionClass = "excellent";
        else if (ratio < 0.6) compressionClass = "good";
        else if (ratio < 0.9) compressionClass = "poor";
        else compressionClass = "incompressible";
        return { originalBytes, compressedBytes, ratio, compressionClass };
      },
    }),
  ],
  output: s.object({
    files: s.record(s.object({
      originalBytes: s.int,
      compressedBytes: s.int,
      ratio: s.number,
      compressionClass: s.enum("excellent", "good", "poor", "incompressible"),
    })),
    totalFiles: s.int,
    averageRatio: s.number,
    mostCompressibleFile: s.optional(s.string),
  }),
  addons: [repair()],
});

export default zlibCompressionAnalyzer;
```
