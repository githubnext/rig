# 369 - Path Structure Analyzer

```rig
import { agent, p, s, defineTool } from "rig";
import { repair } from "rig";
import { basename } from "node:path";

const classifyDirectory = defineTool("classifyDirectory", {
  description: "Classify a directory by its purpose based on its name and depth.",
  parameters: s.object({ dirPath: s.string }),
  handler: ({ dirPath }: { dirPath: string }) => {
    const name = basename(dirPath).toLowerCase();
    const depth = dirPath.split("/").filter(Boolean).length;
    const srcNames = ["src", "lib", "source", "app", "packages"];
    const testNames = ["test", "tests", "spec", "specs", "__tests__", "e2e"];
    const configNames = ["config", "configs", "configuration", ".github", "settings"];
    const buildNames = ["dist", "build", "out", "output", "target", "bin", ".next", ".cache"];
    const vendorNames = ["vendor", "node_modules", "third_party", "external", "deps"];
    let category: "src" | "test" | "config" | "build" | "vendor" | "other" = "other";
    if (srcNames.includes(name)) category = "src";
    else if (testNames.includes(name)) category = "test";
    else if (configNames.includes(name)) category = "config";
    else if (buildNames.includes(name)) category = "build";
    else if (vendorNames.includes(name)) category = "vendor";
    return { depth, category };
  },
});

// Agent role: analyze directory structure of a given root path and classify each subdirectory.
const pathStructureAnalyzer = agent({
  model: "small",
  input: s.object({ rootDir: s.string }),
  instructions: p`Analyze the directory structure of the given root path.

Directories found (up to depth 3):
${p.bash("find . -maxdepth 3 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort || echo ''")}

Steps:
1. For each directory path, call classifyDirectory.
2. Build the directories record keyed by path with depth and category.
3. Set maxDepth to the maximum depth seen.
4. Build categoryCounts as a record counting directories per category.`,
  output: s.object({
    directories: s.record(s.object({
      depth: s.number,
      category: s.enum("src", "test", "config", "build", "vendor", "other"),
    })),
    maxDepth: s.number,
    categoryCounts: s.record(s.number),
  }),
  tools: [classifyDirectory],
  maxTurns: 6,
  addons: [repair()],
});

export default pathStructureAnalyzer;
```
