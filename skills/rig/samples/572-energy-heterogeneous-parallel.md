# 572 - Energy Heterogeneous Parallel

```rig
import { p, s, workflow } from "rig";

const meterReading = s.object({
  meterId: s.string,
  timestamp: s.string,
  kwh: s.number,
});
type MeterReading = { meterId: string; timestamp: string; kwh: number };

const labelResolution = s.object({
  sourceLocale: s.string,
  labels: s.record(s.object({ fr: s.string, ja: s.string })),
  unresolved: s.array(s.string),
});
type LabelResolution = { sourceLocale: string; labels: Record<string, { fr: string; ja: string }>; unresolved: string[] };
type BranchResult = MeterReading | LabelResolution;

const joined = s.object({
  meterReading: s.nullable(meterReading),
  labelResolution: s.nullable(labelResolution),
  missingBranches: s.array(s.enum("meter-parser", "label-resolver")),
});

// Workflow role: parse heterogeneous energy branches and join them without hiding failures.
const energyReconcile = workflow({
  meta: {
    name: "energy-heterogeneous-parallel",
    description: "Parse a meter and resolve multilingual labels in heterogeneous parallel branches, then join with null holes",
    phases: ["Parse", "Join"],
  },
  body: async ({ call, parallel, phase }) => {
    phase("Parse");
    const branches = (await parallel<BranchResult | null>([
      () => call.json(p`Parse each meter row into one reading. Return exact fields from ${p.bash("printf %s\\n M-17,2026-11-25T00:00Z,1.20 M-18,2026-11-25T00:00Z,0.95")}`, meterReading, { label: "meter-parser", model: "small" }),
      () => call.json(p`Resolve English labels into French and Japanese from ${p.bash("printf %s\\n temperature=Temperature humidity=Humidity power=Power")}. Return sourceLocale, labels with fr/ja values, and unresolved keys.`, labelResolution, { label: "label-resolver", model: "small" }),
    ])) as [MeterReading | null, LabelResolution | null];
    const [reading, labels] = branches;
    const missingBranches = [
      reading === null ? "meter-parser" : null,
      labels === null ? "label-resolver" : null,
    ].filter((name): name is "meter-parser" | "label-resolver" => name !== null);
    phase("Join");
    return call.json(p`Join these heterogeneous branch results without inventing data. Preserve null holes exactly in the corresponding output field. Meter branch: ${JSON.stringify(reading)}. Label branch: ${JSON.stringify(labels)}. Missing branches: ${JSON.stringify(missingBranches)}. Copy present values unchanged and return the declared join schema.`, joined, { label: "join", model: "mini" });
  },
});

export default energyReconcile;
```
