# 578 - Language Linked Update Review

```rig
import { agent, p, s, workflow } from "rig";

const edge = s.object({ from: s.string, to: s.string });
const graph = s.object({ lessons: s.array(s.string), edges: s.array(edge) });
const review = s.object({ verdict: s.enum("pass", "revise"), findings: s.array(s.string) });
const planInput = s.object({ original: graph, removed: s.string, previous: s.nullable(graph), review: s.nullable(review), validation: s.array(s.string) });

// Agent role: propose a complete updated lesson graph, incorporating review feedback.
const draftPlan = agent({
  name: "draftPlan", model: "small", input: planInput, output: graph,
  instructions: p`Produce the complete graph after removing input.removed. Preserve all other lessons and every edge not incident to the removed lesson; add no edges. On revision, address input.review and input.validation. ${p.bash("printf '%s' 'An edge references both its from and to lessons.'")}`,
});

// Agent role: delegate graph planning and forward the structured proposal unchanged.
const planner = agent({
  name: "planner", model: "small", input: planInput, output: graph, agents: { draftPlan },
  instructions: "Call draftPlan once with the complete input and return its complete result unchanged.",
});

// Agent role: independently review the entire candidate against the original graph and removal.
const reviewer = agent({
  name: "reviewer", model: "small",
  input: s.object({ original: graph, removed: s.string, candidate: graph }), output: review,
  instructions: "Check every candidate edge endpoint for dangling references, and check that the removed lesson and its incident edges are gone. Verify all other lessons and edges are preserved exactly, with no additions or duplicates. Return pass only if every check succeeds; otherwise return revise with specific findings.",
});

// Workflow role: review one proposal, revise at most once, and gate acceptance while retaining the audit.
const linkedUpdateReview = workflow({
  meta: { name: "language-linked-update-review", description: "Review a bounded lesson-graph update" },
  body: async ({ call }) => {
    const original = { lessons: ["basics", "greetings", "travel", "food"], edges: [
      { from: "greetings", to: "basics" }, { from: "travel", to: "basics" },
      { from: "basics", to: "food" }, { from: "travel", to: "food" },
    ] };
    const removed = "basics";
    const validate = (candidate: { lessons: string[]; edges: { from: string; to: string }[] }) => {
      const sorted = (values: string[]) => JSON.stringify([...values].sort());
      const keys = (edges: { from: string; to: string }[]) => edges.map(e => JSON.stringify([e.from, e.to]));
      const expectedLessons = original.lessons.filter(id => id !== removed);
      const expectedEdges = original.edges.filter(e => e.from !== removed && e.to !== removed);
      const issues: string[] = [];
      if (sorted(candidate.lessons) !== sorted(expectedLessons)) issues.push("Lessons differ from the expected update.");
      if (sorted(keys(candidate.edges)) !== sorted(keys(expectedEdges))) issues.push("Edges differ from the expected update.");
      if (candidate.edges.some(e => !candidate.lessons.includes(e.from) || !candidate.lessons.includes(e.to))) issues.push("Candidate has dangling references.");
      return issues;
    };
    const initial = await call(planner, { original, removed, previous: null, review: null, validation: [] });
    const initialValidation = initial ? validate(initial) : ["Initial planning failed."];
    const initialReview = initial ? await call(reviewer, { original, removed, candidate: initial }) : null;
    const needsRevision = initial && initialReview && (initialReview.verdict !== "pass" || initialValidation.length > 0);
    const revision = needsRevision ? await call(planner, { original, removed, previous: initial, review: initialReview, validation: initialValidation }) : null;
    const revisionValidation = revision ? validate(revision) : null;
    const finalReview = revision ? await call(reviewer, { original, removed, candidate: revision }) : null;
    const accepted = revision ? finalReview?.verdict === "pass" && revisionValidation?.length === 0 : !needsRevision && initialReview?.verdict === "pass" && initialValidation.length === 0;
    return { original, removed, initial, initialReview, initialValidation, revision, revisionValidation, finalReview, status: accepted ? "accepted" : "blocked" };
  },
});

export default linkedUpdateReview;
```
