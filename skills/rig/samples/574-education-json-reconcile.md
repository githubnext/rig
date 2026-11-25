# 574 - Education JSON Reconcile

```rig
import { agent, p, s, workflow } from "rig";

const educationInput = s.object({
  gradeTable: s.object({
    rows: s.array(s.object({
      studentId: s.string,
      term: s.string,
      scores: s.record(s.int),
    })),
  }),
  measurementTable: s.object({
    rows: s.array(s.object({
      studentId: s.string,
      term: s.string,
      scores: s.record(s.int),
    })),
  }),
});

// Agent role: reconcile nested education grade and measurement tables while preserving source values and reasons.
const educationReconciler = agent({
  name: "educationReconciler",
  model: "small",
  input: educationInput,
  instructions: p`Reconcile the nested grade and measurement tables.
Input JSON:
${p.json("input")}

Expand each scores record into a row keyed by studentId, term, and subject. Use the union of keys from both tables, preserving each literal source value (including zero) as null only when that source is absent. If both values exist and agree, use reason "agreed". If only grades exist, use "grade-only"; if only measurements exist, use "measurement-only". For differing values, grades are authoritative: preserve both values, resolve to the grade value, and use reason "grade-wins-conflict". Return one output row per union key.`,
  output: s.object({
    rows: s.array(s.object({
      studentId: s.string,
      term: s.string,
      subject: s.string,
      sourceValues: s.object({
        grade: s.nullable(s.int),
        measurement: s.nullable(s.int),
      }),
      resolved: s.int,
      conflictReason: s.enum("agreed", "grade-only", "measurement-only", "grade-wins-conflict"),
    })),
  }),
});

// Workflow role: supply fixed nested education tables to the typed JSON reconciliation worker.
const educationJsonReconcile = workflow({
  meta: {
    name: "education-json-reconcile",
    description: "Reconcile fixed nested grade and measurement tables with an audit trail",
    phases: ["Reconcile"],
  },
  body: async ({ call, phase }) => {
    phase("Reconcile");
    return call(educationReconciler, {
      gradeTable: {
        rows: [
          { studentId: "S1", term: "Fall", scores: { math: 88, reading: 91 } },
          { studentId: "S2", term: "Fall", scores: { math: 76, science: 84 } },
          { studentId: "S3", term: "Fall", scores: { reading: 95 } },
        ],
      },
      measurementTable: {
        rows: [
          { studentId: "S1", term: "Fall", scores: { math: 90, reading: 91 } },
          { studentId: "S2", term: "Fall", scores: { math: 76, science: 80 } },
          { studentId: "S4", term: "Fall", scores: { math: 89 } },
        ],
      },
    }, { label: "reconcile-education" });
  },
});

export default educationJsonReconcile;
```
