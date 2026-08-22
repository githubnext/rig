# 445 - Zlib Compression Analyzer

```rig
import { agent, p, s, defineTool } from "rig";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { repair } from "rig";

const measureCompressionRatio = defineTool("measureCompressionRatio", {
  description: "Measure the compression ratio of a file using zlib deflate",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const data = await readFile(filePath);
    const originalSize = data.length;
    if (originalSize === 0) {
      return { originalSize: 0, compressedSize: 0, ratio: 0, compressionClass: "incompressible" as const };
    }
    const compressed = deflateSync(data);
    const compressedSize = compressed.length;
    const ratio = 1 - compressedSize / originalSize;
    const compressionClass = ratio > 0.5 ? "excellent" as const
      : ratio > 0.3 ? "good" as const
      : ratio > 0.1 ? "poor" as const
      : "incompressible" as const;
    return { originalSize, compressedSize, ratio, compressionClass };
  },
});

// Agent role: Analyze file compression ratios in a target directory.
const zlibCompressionAnalyzer = agent({
  model: "small",
  input: s.object({ targetDir: s.string }),
  instructions: p`List files in the target directory: ${p.bash("find . -type f -size +0c")}.
For each file, call measureCompressionRatio to measure how compressible it is.
Return per-file compression stats, total file count, average ratio, and the most compressible file.`,
  output: s.object({
    files: s.record(s.object({
      originalSize: s.int,
      compressedSize: s.int,
      ratio: s.number,
      compressionClass: s.enum("excellent", "good", "poor", "incompressible"),
    })),
    totalFiles: s.int,
    averageRatio: s.number,
    mostCompressibleFile: s.optional(s.string),
  }),
  tools: [measureCompressionRatio],
  addons: [repair()],
});

export default zlibCompressionAnalyzer;
```
