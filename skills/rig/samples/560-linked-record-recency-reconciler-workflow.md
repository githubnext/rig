# 560 - Linked Record Recency Reconciler Workflow

```rig
import { agent, p, s, workflow } from "rig";

const enrollmentGradeList = s.array(s.object({
  studentId: s.string,
  courseId: s.string,
  grade: s.nullable(s.string),
}));

// Agent role: extract the two conflicting registrar exports into parallel structured enrollment-grade lists.
const extractor = agent({
  model: "small",
  instructions: p`Older CSV export of student-course grades: ${p.bash(`cat <<'EOF'
studentId,courseId,grade
S100,C-ALG101,B+
S100,C-BIO210,A-
S101,C-ALG101,C
S102,C-CHEM150,A
S103,C-HIST220,B
EOF`)}
Newer API snapshot of the SAME pairs (grade may be null for a pair present above): ${p.bash(`cat <<'EOF'
{"studentId":"S100","courseId":"C-ALG101","grade":"A-"}
{"studentId":"S100","courseId":"C-BIO210","grade":"A-"}
{"studentId":"S101","courseId":"C-ALG101","grade":null}
{"studentId":"S102","courseId":"C-CHEM150","grade":"A"}
{"studentId":"S103","courseId":"C-HIST220","grade":"B+"}
EOF`)}
Extract both sources into two parallel lists of the same student-course pairs (keyed by studentId+courseId), each with its grade (null if missing).`,
  output: s.object({ olderCsv: enrollmentGradeList, newerSnapshot: enrollmentGradeList }),
});

// Agent role: apply the newer-wins-unless-null recency rule per pair, classify each resolution, and write the audit-trail report.
const reconciler = agent({
  model: "small",
  input: s.object({ olderCsv: enrollmentGradeList, newerSnapshot: enrollmentGradeList }),
  instructions: p`Given input.olderCsv and input.newerSnapshot (parallel lists of the same student-course pairs keyed by studentId+courseId), resolve each pair's grade: the newer snapshot's grade wins unless it is null, in which case fall back to the older CSV's grade.
Classify each pair: "agreed" if both sources have the same non-null grade; "overridden" if both are non-null but differ and the newer grade was used; "fallback" if the newer grade is null so the older grade was used instead.
Write a markdown reconciliation report with counts of each category and the full list of pairs with resolved grade and classification to ${p.write("reconciliation-report.md", "# Enrollment Grade Reconciliation Report")}.
Return the report path and the counts of agreed, overridden, and fallback pairs.`,
  output: s.object({ reportPath: s.path, agreedCount: s.int, overriddenCount: s.int, fallbackCount: s.int }),
});

// Workflow role: extract conflicting linked-record sources, then reconcile with a recency/null-fallback rule and persist an audit trail.
const linkedRecordRecencyReconcilerWorkflow = workflow({
  meta: {
    name: "linked-record-recency-reconciler-workflow",
    description: "Extract two conflicting enrollment-grade sources then reconcile with recency-priority and null-fallback classification",
    phases: ["Extract", "Reconcile"],
  },
  body: async ({ call, phase }) => {
    phase("Extract");
    const extracted = await call(extractor, "extract both registrar sources", { label: "extract" });

    phase("Reconcile");
    const pairs = { olderCsv: extracted?.olderCsv ?? [], newerSnapshot: extracted?.newerSnapshot ?? [] };
    return call(reconciler, pairs, { label: "reconcile" });
  },
});

export default linkedRecordRecencyReconcilerWorkflow;
```
