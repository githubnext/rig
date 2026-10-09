# 538 - Semver Satisfies Tool

```rig
import { agent, defineTool, p, s } from "rig";

// Tool: check whether a version satisfies a minimum-version range like ">=1.0.0".
const checkSemverSatisfies = defineTool("check_semver_satisfies", {
  description: "Check whether a semantic version satisfies a minimum-version range.",
  parameters: s.object({
    version: s.string,
    range: s.string,
  }),
  handler: async ({ version, range }: { version: string; range: string }) => {
    const parse = (v: string) =>
      v
        .replace(/^[^0-9]*/, "")
        .split(".")
        .map((part: string) => Number.parseInt(part, 10) || 0);
    const match = range.match(/^>=\s*([\d.]+)/);
    if (!match) return { satisfies: false };
    const [vMajor, vMinor, vPatch] = parse(version);
    const [rMajor, rMinor, rPatch] = parse(match[1]);
    const satisfies =
      vMajor > rMajor ||
      (vMajor === rMajor && vMinor > rMinor) ||
      (vMajor === rMajor && vMinor === rMinor && vPatch >= rPatch);
    return { satisfies };
  },
});

// Agent role: check each package.json dependency against a minimum-version range.
const dependencyRangeCheck = agent({
  model: "small",
  instructions: p`Read ${p.read("package.json")} and list its dependencies. For
    each dependency, call check_semver_satisfies with its declared version and
    range ">=1.0.0", then return the combined results.`,
  tools: [checkSemverSatisfies],
  output: s.array(
    s.object({
      name: s.string,
      version: s.string,
      satisfiesRange: s.boolean,
    }),
  ),
});

export default dependencyRangeCheck;
```
