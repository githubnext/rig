# 455 - Zlib Compression Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const measureCompressionRatio = defineTool("measureCompressionRatio", {
  description: "Measure the zlib compression ratio of a file and classify it",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const buf = await readFile(filePath);
    const originalSize = buf.length;
    if (originalSize === 0) {
      return { ratio: 1, compressionClass: "incompressible" as const, originalSize: 0, compressedSize: 0 };
    }
    const compressed = deflateSync(buf);
    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;
    const compressionClass: "excellent" | "good" | "poor" | "incompressible" =
      ratio < 0.3 ? "excellent" : ratio < 0.6 ? "good" : ratio < 0.9 ? "poor" : "incompressible";
    return { ratio, compressionClass, originalSize, compressedSize };
  },
});

// Agent role: Analyze zlib compression ratios for files in targetDir and report compressibility.
const zlibCompressionAnalyzer = agent({
  model: "small",
  input: s.object({ targetDir: s.string }),
  instructions: p`List files to analyze using: ${p.bash("find . -maxdepth 3 -type f -not -path './.git/*' | head -30")}. Call measureCompressionRatio for each file path. Return the full analysis.`,
  output: s.object({
    files: s.record(s.object({
      ratio: s.number,
      compressionClass: s.enum("excellent", "good", "poor", "incompressible"),
      originalSize: s.int,
      compressedSize: s.int,
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
