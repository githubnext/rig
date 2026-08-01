# 343 - Dockerfile Layer Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseLayer = defineTool("parseLayer", {
  description: "Classify a Dockerfile instruction line for cache-friendliness and weight",
  parameters: s.object({ line: s.string }),
  handler({ line }) {
    const trimmed = line.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const instruction = spaceIdx >= 0 ? trimmed.slice(0, spaceIdx).toUpperCase() : trimmed.toUpperCase();
    const args = spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1) : "";
    const isHeavy = instruction === "RUN" && /apt-get|npm install|pip install|yarn|apk add/.test(args);
    const cacheable = (instruction === "COPY" || instruction === "ADD") && /package\.json|requirements\.txt|go\.mod/.test(args);
    const tip = isHeavy ? "Combine adjacent RUN commands to reduce layers" as const
      : cacheable ? null
      : instruction === "COPY" ? "Copy dependency manifests first for better cache" as const
      : null;
    return { instruction, cacheable, isHeavy, tip };
  },
});

// Agent role: analyze Dockerfile layers for cache efficiency and suggest optimizations.
const dockerfileLayerAnalyzer = agent({
  model: "small",
  instructions: p`Dockerfile content: ${p.readOptional("Dockerfile", "# no Dockerfile found")}

Parse each non-empty, non-comment instruction line. Call parseLayer for each. Count totalLayers. Set optimizable to true if any layer has isHeavy true or a non-null tip. Collect all non-null tips into suggestions.`,
  output: s.object({
    layers: s.array(s.object({
      instruction: s.string,
      cacheable: s.boolean,
      isHeavy: s.boolean,
      tip: s.optional(s.string),
    })),
    totalLayers: s.int,
    optimizable: s.boolean,
    suggestions: s.array(s.string),
  }),
  tools: [parseLayer],
  addons: [repair()],
  maxTurns: 5,
});

export default dockerfileLayerAnalyzer;
```
