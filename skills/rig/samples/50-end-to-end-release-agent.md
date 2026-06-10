# 50 - End To End Release Agent

```rig
import { agent, p, s } from "rig";
// Agent role: summarize the release candidate changes.
const analyzeChanges = agent({ model: "mini",
  input: s.object({ diff: s.string, commits: s.string }),
  output: s.object({ summary: s.string, highlights: s.array(s.string) }),
  instructions: "Summarize the release candidate changes.",
});
// Agent role: choose the safest semantic version bump.
const chooseVersion = agent({ model: "mini",
  input: s.object({ summary: s.string, highlights: s.array(s.string) }),
  output: s.object({ bump: s.enum("patch", "minor", "major"), rationale: s.string }),
  instructions: "Choose the safest semantic version bump.",
});
// Agent role: draft the release note from the chosen version bump.
const draftRelease = agent({ model: "mini",
  input: s.object({ bump: s.enum("patch", "minor", "major"), rationale: s.string, summary: s.string }),
  output: s.object({ title: s.string, checklist: s.array(s.string), risks: s.array(s.string) }),
  instructions: "Draft the release note from the chosen version bump.",
});
// Agent role: plan the next release using the provided specialists.
const releaseAgent = agent({ model: "mini",
  instructions: p`Plan the next release using ${p.bash("git diff --stat -- .")} and ${p.bash("git log --oneline -20")}.`,
  output: s.object({ title: s.string, bump: s.enum("patch", "minor", "major"), checklist: s.array(s.string), risks: s.array(s.string) }),
  agents: { analyzeChanges, chooseVersion, draftRelease },
});
export default releaseAgent;
```
