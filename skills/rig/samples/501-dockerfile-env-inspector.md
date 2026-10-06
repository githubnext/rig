# 501 - Dockerfile ENV Inspector

```rig
import { agent, p, s, defineTool, repair } from "rig";
import { readFile } from "node:fs/promises";

const extractDockerfileEnv = defineTool("extractDockerfileEnv", {
  description: "Extract ENV instructions from a Dockerfile",
  parameters: s.object({ filePath: s.string }),
  handler: async ({ filePath }: { filePath: string }) => {
    const content = await readFile(filePath, "utf8");
    const envVars: Record<string, string> = {};
    const keyValueRe = /^ENV\s+(\w+)=(\S+)/gm;
    const keySpaceRe = /^ENV\s+(\w+)\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = keyValueRe.exec(content)) !== null) {
      envVars[m[1]] = m[2];
    }
    while ((m = keySpaceRe.exec(content)) !== null) {
      if (!(m[1] in envVars)) envVars[m[1]] = m[2].trim();
    }
    return envVars;
  },
});

// Agent role: Parse ENV instructions from all Dockerfiles in the workspace and classify each variable.
const dockerfileEnvInspector = agent({
  model: "small",
  instructions: p`You are given the output of: ${p.bash("find . -name Dockerfile -o -name 'Dockerfile.*' 2>/dev/null | head -20")}.
For each Dockerfile path found, call extractDockerfileEnv to extract its ENV variables.
Classify each variable as build-time (used during build, e.g. VERSION, BUILD_DATE) or runtime (passed to app at runtime).
Return the declared output.`,
  output: s.object({
    files: s.record(s.record(s.string)),
    totalVars: s.int,
    totalFiles: s.int,
  }),
  tools: [extractDockerfileEnv],
  addons: [repair()],
});

export default dockerfileEnvInspector;
```
