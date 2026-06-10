# 02 - Review Git Diff

```rig
import { p } from "rig";

// Agent role: review the repository diff and return a structured summary.

export default p`Review ${p.bash("git diff --stat")} and ${p.bash("git status --short")} and return a concise summary with key findings.`;
```
