# 529 - Parallel Wordfreq Aggregator

```rig
import { agent, p, s, workflow } from "rig";

// Agent role: summarize word frequency across rig sample markdown files.
const sampleWordFreq = agent({
  model: "small",
  instructions: p`Find sample files: ${p.glob("skills/rig/samples/*.md")}. Read a representative subset of them and compute the frequency of the most common meaningful words across their content. Return a record mapping each word to its occurrence count.`,
  output: s.record(s.int, "word occurrence counts across sample markdown files"),
});

// Agent role: summarize word frequency across TypeScript source files.
const sourceWordFreq = agent({
  model: "small",
  instructions: p`Find TypeScript source files: ${p.glob("src/**/*.ts")}. Read a representative subset of them and compute the frequency of the most common meaningful words (identifiers, comments) across their content. Return a record mapping each word to its occurrence count.`,
  output: s.record(s.int, "word occurrence counts across TypeScript source files"),
});

// Agent role: merge two word-frequency records, summing counts for shared keys.
const wordFreqMerger = agent({
  model: "small",
  input: s.object({
    samples: s.record(s.int),
    source: s.record(s.int),
  }),
  instructions:
    "Merge input.samples and input.source into one combined record of word to occurrence count, summing counts for words that appear in both.",
  output: s.record(s.int, "combined word occurrence counts"),
});

// Workflow role: compute word frequencies for samples and source in parallel, then merge them.
// Uses Promise.all because both agent calls share the same output type (a record of string to number).
const parallelWordFreq = workflow({
  meta: {
    name: "parallel-wordfreq-aggregator",
    description: "Summarize word frequency in samples and source in parallel, then aggregate",
    phases: ["Summarize", "Aggregate"],
  },
  body: async ({ call, phase }) => {
    phase("Summarize");
    const [samples, source] = await Promise.all([
      call(sampleWordFreq, "summarize sample word frequency"),
      call(sourceWordFreq, "summarize source word frequency"),
    ]);
    phase("Aggregate");
    return call(
      wordFreqMerger,
      {
        samples: samples ?? {},
        source: source ?? {},
      },
      { label: "merge" },
    );
  },
});

export default parallelWordFreq;
```
