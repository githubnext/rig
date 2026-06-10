# 59 - GenAIScript City Info Port

```rig
import { agent, s } from "rig";
// Agent role: extract structured city facts from a short dataset.
const cityInfoPort = agent({
  model: "mini",
  instructions: "From this dataset, return a JSON array of city facts only: Cairo | population 10.1M | https://en.wikipedia.org/wiki/Cairo ; Alexandria | population 5.6M | https://en.wikipedia.org/wiki/Alexandria ; Giza | population 4.8M | https://en.wikipedia.org/wiki/Giza.",
  output: s.array(s.object({ name: s.string, population: s.number, url: s.string })),
});
export default cityInfoPort;
```
