# 571 - Experiment Handoff Audit

```rig
import { agent, p, s } from "rig";

const observation = s.object({
  runId: s.string, sourceLine: s.int,
  temperatureC: s.nullable(s.number), pH: s.nullable(s.number),
  yieldPercent: s.nullable(s.number), remark: s.nullable(s.string),
});
const extractionReport = s.object({
  observations: s.array(observation), fieldCoverage: s.record(s.int), parseNotes: s.array(s.string),
});

// Agent role: parse free-form lab notes into typed nullable observations.
const extractor = agent({
  name: "extractor", model: "small", input: s.object({ notes: s.string }),
  instructions: "Parse input.notes into one observation per run. Use null, never invented values, for absent temperatureC, pH, yieldPercent, or remark; preserve 1-based sourceLine, normalize temperature to C and yield to numeric percent, and record repeated-value conflicts in remark. Return fieldCoverage counts and concise parseNotes.",
  output: extractionReport,
});

const auditReport = s.object({
  verdict: s.enum("clean", "needs_review"),
  missing: s.array(s.object({ runId: s.string, field: s.string, reason: s.string })),
  contradictions: s.array(s.object({ runId: s.string, field: s.string, values: s.array(s.number), reason: s.string })),
  severityByRun: s.record(s.enum("clean", "missing", "contradictory", "missing_and_contradictory")), checkedRuns: s.int,
});

// Agent role: audit extracted observations for missing and contradictory measurements.
const auditor = agent({
  name: "auditor", model: "small", input: extractionReport,
  instructions: "Audit only input.observations. Mark every null measurement field as missing and every contradiction described in remark, including repeated numeric values, in contradictions. Add one severityByRun entry per run and checkedRuns; do not recover data from the original notes.",
  output: auditReport,
});

// Agent role: coordinate a typed extractor-to-auditor handoff and preserve both reports.
const experimentReportAudit = agent({
  name: "experimentReportAudit", model: "large", agents: { extractor, auditor },
  instructions: p`Use only these synthetic lab notes:\n${p.bash("printf '%s\\n' 'Run R-17 | temp 22 C | pH 7.1 | yield 84% | clear' 'Run R-18 | temp 23 C | yield 79% | pH not recorded' 'Run R-19 | temp 21 C | pH 6.8 | yield 88% | repeat yield 82%' 'Run R-20 | temp not recorded | pH 7.0 | yield 91% | stable")}\nCall extractor first with { notes: the exact note text above }, then pass its complete structured result unchanged as the typed input to auditor. Do not flatten, summarize, or reread the notes. Return both complete reports and handoffEvidence with sequence [extractor, auditor, root], the forwarded nullable field names, the observation count, and passedUnchanged=true.`,
  output: s.object({
    extraction: extractionReport, audit: auditReport,
    handoffEvidence: s.object({ sequence: s.array(s.enum("extractor", "auditor", "root")), observationCountForwarded: s.int, forwardedNullableFields: s.array(s.string), passedUnchanged: s.boolean }),
  }),
});

export default experimentReportAudit;
```
