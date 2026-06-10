# 61 - GenAIScript List Files Port

```rig
import { agent, p, s } from "rig";
// Agent role: pick the most interesting rig sample files.
const listFilesPort = agent({
  model: "nano",
  instructions: p`Review ${p.bash("find skills/rig/samples -maxdepth 1 -name '*.md' | sort")}. Select the 3 most interesting sample files.`,
  output: s.object({ files: s.array(s.string) }),
});
export default listFilesPort;
```
