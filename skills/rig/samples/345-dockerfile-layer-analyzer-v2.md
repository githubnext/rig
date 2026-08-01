# 345 - Dockerfile Layer Analyzer V2

```rig
import { agent, p, s, defineTool, repair } from "rig";

// Agent role: Analyze Dockerfile layers for cache-friendliness and optimization opportunities.
const dockerfileLayerAnalyzer = agent({
  model: "small",
  instructions: p`You are a Dockerfile layer analyzer.

Dockerfile content:
${p.readOptional("Dockerfile")}

${defineTool("parseLayer", {
  description: "Classify a Dockerfile instruction for cache-friendliness and weight",
  parameters: s.object({ instruction: s.string, args: s.string }),
  handler: (args) => {
    const isHeavy = ["npm install", "apt-get", "pip install", "COPY . ."].some(
      (p) => args.args.includes(p)
    );
    const cacheable = args.instruction !== "RUN" || !isHeavy;
    const tip = isHeavy
      ? "Move to earlier layer or use cache mounts to improve build speed"
      : "";
    return { cacheable, isHeavy, tip };
  },
})}

Parse each Dockerfile instruction, classify each layer, identify optimizations, and return the structured result.`,
  output: s.object({
    layers: s.array(s.object({
      instruction: s.string,
      cacheable: s.boolean,
      isHeavy: s.boolean,
      tip: s.string,
    })),
    totalLayers: s.int,
    optimizable: s.boolean,
    suggestions: s.array(s.string),
  }),
  addons: [repair()],
});

export default dockerfileLayerAnalyzer;
```
