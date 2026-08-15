# 415 - Os Path Structure Analyzer

```rig
import { agent, defineTool, p, repair, s } from "rig";
import { basename } from "node:path";

const classifyDirectory = defineTool("classifyDirectory", {
  description: "Classify a directory path into a category based on its basename.",
  parameters: s.object({ dirPath: s.path, rootDir: s.string }),
  handler({ dirPath, rootDir }: { dirPath: string; rootDir: string }) {
    const name = basename(dirPath);
    const depth = dirPath.replace(rootDir, "").split("/").filter(Boolean).length;
    const srcNames = new Set(["src", "lib", "source"]);
    const testNames = new Set(["test", "tests", "__tests__", "spec", "specs"]);
    const configNames = new Set(["config", "configs", "conf", ".config"]);
    const buildNames = new Set(["dist", "build", "out", "output", ".next", ".cache"]);
    const vendorNames = new Set(["node_modules", "vendor", "third_party"]);
    const category = srcNames.has(name) ? "src"
      : testNames.has(name) ? "test"
      : configNames.has(name) ? "config"
      : buildNames.has(name) ? "build"
      : vendorNames.has(name) ? "vendor"
      : "other";
    return { depth, category };
  },
});

// Agent role: analyze the directory structure of a given root path and classify each directory.
const osPathStructureAnalyzer = agent({
  model: "small",
  input: s.object({ rootDir: s.string }),
  instructions: p`Analyze the directory structure of the given rootDir.

Directories found:
${p.bash("find . -maxdepth 3 -type d -not -path '*/node_modules/*' 2>/dev/null || echo '(none)'")}

For each directory, call classifyDirectory with its path and the rootDir. Build the directories record. Compute maxDepth and categoryCounts.`,
  output: s.object({
    directories: s.record(s.object({
      depth: s.number,
      category: s.string,
    })),
    maxDepth: s.number,
    categoryCounts: s.record(s.number),
  }),
  tools: [classifyDirectory],
  addons: [repair()],
});

export default osPathStructureAnalyzer;
```
