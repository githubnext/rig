# 419 - Dockerfile ENV Inspector

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractDockerfileEnv = defineTool("extractDockerfileEnv", {
  description: "Extract ENV instructions from a Dockerfile and classify each variable as build-time or runtime",
  parameters: s.object({ filePath: s.path }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const results: Record<string, { value: string; envType: "build-time" | "runtime" }> = {};
    // Handle ENV KEY VALUE form
    const singleRe = /^ENV\s+([A-Z_][A-Z0-9_]*)\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = singleRe.exec(content)) !== null) {
      const key = m[1];
      const value = m[2].trim();
      const envType = /^(BUILD_|CI_)/.test(key) ? "build-time" as const : "runtime" as const;
      results[key] = { value, envType };
    }
    // Handle ENV KEY=VALUE form
    const assignRe = /^ENV\s+(.+)$/gm;
    while ((m = assignRe.exec(content)) !== null) {
      const pairs = m[1].split(/\s+/);
      for (const pair of pairs) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx > 0) {
          const key = pair.slice(0, eqIdx);
          const value = pair.slice(eqIdx + 1);
          const envType = /^(BUILD_|CI_)/.test(key) ? "build-time" as const : "runtime" as const;
          results[key] = { value, envType };
        }
      }
    }
    return { filePath, envVars: results };
  },
});

// Agent role: Parse ENV instructions from all Dockerfiles and classify each variable as build-time or runtime.
const dockerfileEnvInspector = agent({
  model: "small",
  instructions: p`Parse ENV instructions from all Dockerfiles in the workspace.
Dockerfiles: ${p.bash("find . -name 'Dockerfile*' -not -path '*/node_modules/*'")}
Use extractDockerfileEnv on each file path.
Return:
- files: record mapping file path to { envVars: record mapping var name to { value, envType } }
- totalVars: total number of ENV variables found across all files
- totalFiles: number of files processed`,
  output: s.object({
    files: s.record(s.object({
      envVars: s.record(s.object({
        value: s.string,
        envType: s.enum("build-time", "runtime"),
      })),
    })),
    totalVars: s.int,
    totalFiles: s.int,
  }),
  tools: [extractDockerfileEnv],
  addons: [repair()],
});

export default dockerfileEnvInspector;
```
