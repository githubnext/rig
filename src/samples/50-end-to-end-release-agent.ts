import { agent, p, s } from "rig";

// Agent role: summarize the release candidate changes from the diff and recent commits.

const analyzeChanges = agent({
  model: "mini",
  instructions: "Summarize the release candidate changes from the diff and recent commits.",
  input: s.object({
    diff: s.string,
    commits: s.string,
  }),
  output: s.object({
    summary: s.string,
    highlights: s.array(s.string),
  }),
});

// Agent role: choose the safest semantic version bump for the summarized changes.

const chooseVersion = agent({
  model: "mini",
  instructions: "Choose the safest semantic version bump for the summarized changes.",
  input: s.object({
    summary: s.string,
    highlights: s.array(s.string),
  }),
  output: s.object({
    bump: s.enum("patch", "minor", "major"),
    rationale: s.string,
  }),
});

// Agent role: draft the release title, checklist, and risks for the chosen version bump.

const draftRelease = agent({
  model: "mini",
  instructions: "Draft the release title, checklist, and risks for the chosen version bump.",
  input: s.object({
    bump: s.enum("patch", "minor", "major"),
    rationale: s.string,
    summary: s.string,
    highlights: s.array(s.string),
  }),
  output: s.object({
    title: s.string,
    checklist: s.array(s.string),
    risks: s.array(s.string),
  }),
});

const analysis = await analyzeChanges({
  diff: p.bash("git diff --stat -- ."),
  commits: p.bash("git log --oneline -20"),
});

const version = await chooseVersion(analysis);

await draftRelease({
  ...analysis,
  ...version,
});

// Agent role: orchestrate release analysis, versioning, and release draft planning.
const releaseCoordinator = agent({
  model: "mini",
  instructions: "Use the provided subagents to produce a complete release draft from repo signals.",
  output: s.object({
    title: s.string,
    checklist: s.array(s.string),
    risks: s.array(s.string),
  }),
  agents: { analyzeChanges, chooseVersion, draftRelease },
});

export default releaseCoordinator;
