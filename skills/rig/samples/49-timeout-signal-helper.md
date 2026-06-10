# 49 - Timeout Signal Helper

```rig
import { agent, s } from "rig";
import { timeout } from "rig/addons";
// Agent role: return a short response before the timeout expires.
const worker = agent({
  model: "mini",
  instructions: "Return a short response before the timeout expires.",
  addons: timeout({ timeout: 5_000 }),
});
export default worker;
```
