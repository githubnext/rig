# 216 - Dockerfile Layer Analyzer

```rig
import { agent, p, s, defineTool, repair } from "rig";

const parseLayer = defineTool("parseLayer", {
  description: "Classify a Dockerfile instruction for cache-friendliness and weight",
  parameters: s.object({
    instruction: s.string,
    args: s.string,
  }),
  handler({ instruction, args }) {
    const inst = instruction.toUpperCase();
    const isPackageFile = /package\.json|requirements\.txt|Pipfile|go\.mod|Cargo\.toml/.test(args);
    const isHeavy = (inst === "RUN") && /apt-get|npm install|pip install|yarn|apk add/.test(args);
    const cacheable = (inst === "COPY" || inst === "ADD") && isPackageFile;
    let tip: string | null = null;
    if (inst === "RUN" && isHeavy) tip = "Combine adjacent RUN commands to reduce layers";
    if (inst === "COPY" && !cacheable) tip = "Copy only dependency manifests first to improve cache";
    return { instruction: inst, cacheable, isHeavy, tip };
  },
});

// Agent role: analyze Dockerfile layers for cache efficiency and suggest optimizations.
const dockerfileLayerAnalyzer = agent({
  model: "small",
  instructions: p`Read the Dockerfile: ${p.readOptional("Dockerfile", "# no Dockerfile found")}. Parse each instruction line (FROM, RUN, COPY, ADD, ENV, EXPOSE, CMD, ENTRYPOINT, etc.). Use the parseLayer tool for each instruction with its arguments. Count total layers. Set optimizable to true if any layer has isHeavy or a non-null tip. Collect all non-null tips into suggestions.`,
  output: s.object({
    layers: s.array(s.object({
      instruction: s.string,
      args: s.string,
      cacheable: s.boolean,
      isHeavy: s.boolean,
      tip: s.optional(s.string),
    })),
    totalLayers: s.int,
    optimizable: s.boolean,
    suggestions: s.array(s.string),
  }),
  tools: [parseLayer],
  addons: repair(),
});

export default dockerfileLayerAnalyzer;
```
