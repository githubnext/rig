# 57 - GenAIScript Issue Review Port

```rig
import { agent, s } from "rig";
// Agent role: review a GitHub issue report and return concise feedback.
const issueReviewPort = agent({
  model: "mini",
  instructions: "Review this issue draft: \"The CLI crashes sometimes when reading stdin programs on Windows. I expected it to work.\" Ask only for missing reproduction details and missing expected behavior.",
  output: s.object({ summary: s.string, questions: s.array(s.string) }),
});
export default issueReviewPort;
```
