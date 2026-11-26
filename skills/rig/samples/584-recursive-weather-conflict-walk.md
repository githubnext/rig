# 584 - Recursive Weather Conflict Walk

```rig
import { s, workflow, type Workflow } from "rig";
type WeatherNode = { path: string[]; readings: Record<string, string | null> };
type Unresolved = { source: string; value: string | null };
type Resolution = { path: string[]; value: string | null; provenance: Record<string, string | null>; unresolved: Unresolved[] };
type WalkInput = { nodes: WeatherNode[]; index: number };
type WalkOutput = { descendants: Resolution[] };

// Workflow role: reconcile one weather node while preserving source provenance and unresolved readings.
const resolveNode: Workflow<WeatherNode, Resolution> = workflow({
  meta: { name: "resolve-weather-node", description: "Reconcile one weather node", phases: ["Resolve"] },
  input: s.object({ path: s.array(s.string), readings: s.record(s.nullable(s.string)) }),
  body: async ({ input, phase }): Promise<Resolution> => {
    phase("Resolve");
    const entries = Object.entries(input.readings);
    const known = entries.filter((entry): entry is [string, string] => entry[1] !== null);
    const distinct = [...new Set(known.map(([, value]) => value))];
    const unresolved = (distinct.length > 1 ? entries : entries.filter(([, value]) => value === null)).map(([source, value]) => ({ source, value }));
    return { path: input.path, value: distinct.length === 1 ? distinct[0] ?? null : null, provenance: Object.fromEntries(entries), unresolved };
  },
});

// Workflow role: recursively walk nested paths and aggregate resolved descendants.
let walkWeather: Workflow<WalkInput, WalkOutput>;
walkWeather = workflow({
  meta: { name: "walk-weather", description: "Recursively resolve nested weather paths", phases: ["Walk"] },
  input: s.object({ nodes: s.array(s.object({ path: s.array(s.string), readings: s.record(s.nullable(s.string)) })), index: s.int }),
  body: async ({ input, call, phase }): Promise<WalkOutput> => {
    phase("Walk");
    const current = input.nodes[input.index];
    if (!current) return { descendants: [] };
    const resolved = await call.workflow(resolveNode, current, { label: current.path.join("/") });
    const rest = input.index + 1 < input.nodes.length ? await call.workflow(walkWeather, { nodes: input.nodes, index: input.index + 1 }, { label: `walk/${input.nodes[input.index + 1].path.join("/")}` }) : { descendants: [] };
    return { descendants: [resolved, ...rest.descendants] };
  },
});

const catalog = [
  { path: ["Pacific", "Seattle", "Downtown"], readings: { radar: "rain", station: "showers", forecast: "rain" } },
  { path: ["Pacific", "Seattle", "Ballard"], readings: { radar: "fog", station: null, forecast: "rain" } },
  { path: ["Pacific", "Portland"], readings: { radar: "clear", station: "clear", forecast: "clear" } },
  { path: ["Atlantic", "Boston", "Harbor"], readings: { radar: "snow", station: "sleet", forecast: null } },
  { path: ["Atlantic", "Boston", "Back Bay"], readings: { radar: null, station: "rain", forecast: "rain" } },
] satisfies WeatherNode[];

// Workflow role: resolve independent weather regions in parallel and aggregate every nested result.
const recursiveWeatherConflictWalk = workflow({
  meta: { name: "recursive-weather-conflict-walk", description: "Walk and reconcile a nested weather catalog", phases: ["Regions", "Aggregate"] },
  body: async ({ call, parallel, phase }) => {
    phase("Regions");
    const regions = ["Pacific", "Atlantic"];
    const branches = await parallel(regions.map((region) => () => call.workflow(walkWeather, { nodes: catalog.filter((node) => node.path[0] === region), index: 0 }, { label: region })));
    phase("Aggregate");
    const descendants = branches.flatMap((branch) => branch?.descendants ?? []);
    return { descendants, unresolvedPaths: descendants.filter((node) => node.value === null).map((node) => node.path.join("/")), complete: descendants.length === catalog.length };
  },
});
export default recursiveWeatherConflictWalk;
```
