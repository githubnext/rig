# 562 - Env Typed Config Provenance

```rig
import { agent, p, s } from "rig";

// Agent role: resolve typed ecology survey config from env vars, reporting default provenance and converting units to metric.
const ecologyConfig = agent({
  model: "small",
  maxTurns: 4,
  instructions: p`Resolve the survey configuration for a synthetic ecology field study from environment variables. An empty value means the variable is unset, so use the default and mark its source as "default"; a non-empty value is used verbatim with source "env".

SITE_ID (default "wetland-north-07"): ${p.env("SURVEY_SITE_ID", "")}
HABITAT (default "wetland"; allowed: wetland, forest, grassland, tundra): ${p.env("SURVEY_HABITAT", "")}
TRANSECT_LENGTH (default "330 ft"; value then unit): ${p.env("SURVEY_TRANSECT_LENGTH", "")}
WATER_TEMP (default "68 F"; value then unit): ${p.env("SURVEY_WATER_TEMP", "")}
PLOT_AREA (default "2.5 acre"; value then unit): ${p.env("SURVEY_PLOT_AREA", "")}

Synthetic nested catalog of unit conversions: length (ft->m x0.3048, mi->m x1609.344), temperature (F->C (F-32)/1.8, K->C K-273.15), area (acre->ha x0.404686, ft2->m2 x0.092903). Convert each measurement to metric (m, C, ha), rounding to 2 decimals, and report the original value text, the converted number, the metric unit, and the source for every field. Set defaultedCount to the number of fields whose source is "default".`,
  output: s.object({
    siteId: s.object({ value: s.nonEmptyString, source: s.enum("env", "default") }),
    habitat: s.object({
      value: s.enum("wetland", "forest", "grassland", "tundra"),
      source: s.enum("env", "default"),
    }),
    measurements: s.array(s.object({
      name: s.enum("transectLength", "waterTemp", "plotArea"),
      original: s.nonEmptyString,
      metricValue: s.number,
      metricUnit: s.enum("m", "C", "ha"),
      source: s.enum("env", "default"),
    })),
    defaultedCount: s.int,
  }),
});

export default ecologyConfig;
```
