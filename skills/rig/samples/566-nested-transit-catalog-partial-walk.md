# 566 - Nested Transit Catalog Partial Walk

```rig
import { s, workflow, type Workflow } from "rig";
type Stop = { name: string; status: "on-time" | "delayed" | null; observed: boolean };
type RouteInput = { route: string; stops: Stop[]; index: number };
type PartialObservation = { status: Stop["status"]; observed: boolean };
type RouteOutput = { observations: Array<PartialObservation | null> };
let inspectRoute: Workflow<RouteInput, RouteOutput>;
// Workflow role: recursively inspect one route and retain partial or missing stop observations.
inspectRoute = workflow({
  meta: { name: "inspectRoute", description: "Recursively inspect route stops", phases: ["Walk"] },
  input: s.object({
    route: s.string,
    stops: s.array(s.object({ name: s.string, status: s.nullable(s.enum("on-time", "delayed")), observed: s.boolean })),
    index: s.int,
  }),
  body: async ({ input, call, parallel }): Promise<RouteOutput> => {
    const stop = input.stops[input.index];
    if (!stop) return { observations: [null] };
    const current: PartialObservation = { status: stop.status, observed: stop.observed };
    const [next] = input.index + 1 < input.stops.length
      ? await parallel([() => call.workflow(inspectRoute, { route: input.route, stops: input.stops, index: input.index + 1 }, { label: `${input.route}/${input.stops[input.index + 1].name}` })])
      : [null];
    const holes = input.stops.slice(input.index + 1).map(() => null);
    return { observations: [current, ...(next?.observations ?? holes)] };
  },
});
const catalog = [
  { route: "Blue", stops: [
    { name: "Harbor", status: "on-time", observed: true },
    { name: "Museum", status: null, observed: false },
    { name: "Civic Center", status: "delayed", observed: true },
  ] },
  { route: "Green", stops: [
    { name: "Airport", status: "on-time", observed: true },
    { name: "Market", status: null, observed: false },
  ] },
] satisfies Array<{ route: string; stops: Stop[] }>;
// Workflow role: recursively walk the embedded transit catalog and preserve every route/stop path.
const transitCatalog = workflow({
  meta: { name: "transitCatalog", description: "Walk a partial public-transit catalog", phases: ["Routes", "Aggregate"] },
  body: async ({ call, parallel, phase }) => {
    phase("Routes");
    const branches = await parallel(catalog.map((entry) => () => call.workflow(inspectRoute, { route: entry.route, stops: entry.stops, index: 0 }, { label: entry.route })));
    phase("Aggregate");
    return {
      routes: catalog.map((entry, routeIndex) => {
        const observations = branches[routeIndex]?.observations ?? [];
        return {
          path: [entry.route],
          stops: entry.stops.map((stop, stopIndex) => ({
            path: [entry.route, stop.name],
            observation: observations[stopIndex] ?? null,
          })),
        };
      }),
    };
  },
});
export default transitCatalog;
```
