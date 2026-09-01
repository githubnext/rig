# 510 - Multi Stage Artifact Pipeline

```rig
import { agent, workflow, p, s } from "rig";

// Agent role: Discover build artifacts in the dist directory.
const artifactDiscoverer = agent({
  name: "artifactDiscoverer",
  model: "small",
  instructions: p`List build artifacts: ${p.bash("find dist -type f \\( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' \\) 2>/dev/null | head -100 || echo 'no dist'")}.
For each file, report its path, approximate size (use 0 if unknown), and file extension type.
Return the declared output.`,
  output: s.object({
    artifacts: s.array(s.object({
      path: s.path,
      sizeBytes: s.int,
      type: s.string,
    })),
    totalFound: s.int,
  }),
});

// Agent role: Classify build artifacts by kind (esm, cjs, declaration, sourcemap, other).
const artifactClassifier = agent({
  name: "artifactClassifier",
  model: "small",
  input: s.object({
    artifacts: s.array(s.object({
      path: s.path,
      sizeBytes: s.int,
      type: s.string,
    })),
    totalFound: s.int,
  }),
  instructions: `Classify each artifact: .d.ts → declaration, .js.map → sourcemap, .mjs or esm/**/*.js → esm, .cjs or cjs/**/*.js → cjs, else other.
Return the classified list and a byType count.`,
  output: s.object({
    classified: s.array(s.object({
      path: s.path,
      kind: s.enum("esm", "cjs", "declaration", "sourcemap", "other"),
    })),
    byType: s.record(s.int),
  }),
});

// Workflow role: Discover, classify, and report on dist build artifacts in three sequential stages.
const multiStageArtifactPipeline = workflow({
  meta: { name: "multi-stage-artifact-pipeline", description: "Three-stage pipeline to discover, classify, and report dist build artifacts" },
  body: async ({ call }) => {
    const discovered = await call(artifactDiscoverer, "discover dist artifacts");
    const artifacts = discovered?.artifacts ?? [];
    const totalFound = discovered?.totalFound ?? 0;
    const classified = await call(artifactClassifier, { artifacts, totalFound });
    const byType = classified?.byType ?? {};
    const totalArtifacts = classified?.classified?.length ?? 0;
    const summary = `Found ${totalArtifacts} artifacts: ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(", ")}`;
    return { reportPath: "dist/artifact-report.json", totalArtifacts, byType, summary };
  },
});

export default multiStageArtifactPipeline;
```
