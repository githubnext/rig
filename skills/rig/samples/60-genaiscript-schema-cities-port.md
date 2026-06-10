# 60 - GenAIScript Schema Cities Port

```rig
import { agent, s } from "rig";
// Agent role: invent five city records that match a strict schema.
const schemaCitiesPort = agent({
  model: "mini",
  instructions: "Give 5 cities with their populations and Wikipedia URLs. Return only valid output.",
  output: s.array(s.object({ name: s.string, population: s.number, url: s.string })),
});
export default schemaCitiesPort;
```
