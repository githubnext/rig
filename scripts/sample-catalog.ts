import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import ts from "typescript";

export const buckets = {
  schemas: "Schema-first agents",
  context: "Prompt context and side effects",
  runtime: "Runtime and addons",
  tools: "Custom tools",
  delegation: "Model-driven delegation",
  workflows: "Deterministic workflows",
} as const;

const clusters = [
  ["Tests and CI", /test|coverage|snapshot|lint|ci-|workflow-(?:health|review|validator|input)/],
  ["Changes and releases", /review|diff|patch|migration|refactor|release|changelog|issue|bug|triag|design/],
  ["Git history and workspace", /git|commit|branch|churn|hotspot|stash|worktree|ownership|reflog/],
  ["Configuration and dependencies", /config|dependenc|npm|pkg|package|lock.?file|env|dotenv|semver/],
  ["Types and source structure", /(?:^|-)ts-|typescript|javascript|source|import|export|class|ast|jsdoc|decorator|function|identifier|namespace|symbol|reexport|type-/],
  ["Docs and structured data", /markdown|readme|doc|json|csv|yaml|toml|ini|xml|graphql|proto|schema|cit(?:y|ies)|travel|glossary|slide|link|table/],
] as const;

const familyAliases: Record<string, string> = {
  "pkg-dependency-graph-extractor": "pkg-dependency-graph",
  "json-schema-migration-planner": "json-schema-migration",
  "sequential-commit-pipeline": "sequential-commit-classifier-workflow",
  "hotspot-file-analyzer": "git-hotspot-analyzer",
  "git-hotspot": "git-hotspot-analyzer",
  "loc-statistics": "loc-statistics-gatherer",
  "loc-stats-gatherer": "loc-statistics-gatherer",
  "test-file-naming-enforcer": "test-naming-enforcer",
  "commit-type-enum-classifier": "commit-type-classifier",
  "commit-type-tagger": "commit-type-classifier",
  "healthcheck-timeout-status": "healthcheck-timeout",
  "timeout-health-prober": "healthcheck-timeout",
  "tsconfig-nested-validator": "nested-tsconfig-validator",
  "tsconfig-deep-validator": "nested-tsconfig-validator",
  "glob-tagger-fanout": "glob-tagger-aggregator",
  "fanout-file-tag-aggregator": "glob-tagger-aggregator",
  "http-endpoint-health-checker": "service-health-probe",
  "conventional-commit-suggester": "commit-format-suggester",
};

const roleFamilies = [
  [/^review (?:input\.diff|the (?:repository )?diff)/i, "review-git-diff"],
  [/^diagnose the (?:failing test|test failure)/i, "diagnose-test-failure"],
  [/^generate a concise readme/i, "generate-readme"],
  [/^confirm whether the write intent/i, "write-output"],
  [/^classify (?:the )?(?:github )?issue/i, "classify-issue"],
  [/^triage the pull request/i, "triage-pr"],
  [/^write release notes from commits/i, "release-notes"],
  [/^review dependency security posture/i, "dependency-security-review"],
  [/^create a focused validation plan/i, "test-plan"],
  [/^convert the change description.*changelog/i, "changelog-categorizer"],
  [/^compare public api declarations/i, "api-diff-summary"],
  [/^find documentation gaps/i, "docs-gap-analysis"],
  [/^plan a minimal.*refactor/i, "refactor-plan"],
  [/^return a complete replacement/i, "patch-writer-output"],
  [/^extract a clear reproduction from the issue/i, "issue-reproducer"],
  [/^diagnose the ci log/i, "ci-log-diagnosis"],
  [/^normalize the config/i, "config-normalizer"],
  [/^infer a practical runtime-visible schema/i, "schema-inference"],
  [/^rewrite the error/i, "error-message-improver"],
  [/^write a concise migration guide/i, "migration-guide"],
  [/^review the design proposal/i, "design-review"],
  [/^plan safe dependency upgrades/i, "dependency-upgrade-plan"],
  [/^flag unknown or concerning dependency licenses/i, "dependency-license-audit"],
  [/^draft a github bug report/i, "bug-report-draft"],
  [/^review the workflow for reliability/i, "github-action-review"],
  [/^build a package map/i, "monorepo-package-map"],
  [/^plan shell commands/i, "command-planner"],
  [/^investigate the project using only readonly/i, "readonly-investigator"],
  [/^parse environment outputs/i, "environment-report"],
  [/^extract event metadata/i, "optional-event-metadata"],
  [/^convert the finding into a typed review record/i, "typed-review-record"],
  [/^extract any json object.*raw/i, "raw-json-output"],
  [/^summarize the diff/i, "git-diff-summary"],
  [/^repair input\.text/i, "json-repair"],
  [/^decide whether snapshot updates/i, "snapshot-test-updater"],
  [/^analyze whether the test failure appears flaky/i, "flaky-test-analysis"],
  [/^suggest owners for changed files/i, "code-owner-suggestion"],
] as const;

export interface Sample {
  path: string;
  format: "markdown" | "typescript";
  bucket: keyof typeof buckets;
  cluster: string;
  family: string;
  roles: string[];
  features: string[];
  fingerprint: string;
}

export interface Retirement {
  removed: string;
  retained: string;
}

export function classifySample(path: string, text: string): Sample {
  const format = path.endsWith(".md") ? "markdown" : "typescript";
  const code = format === "markdown"
    ? text.match(/^```rig[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/m)?.[1]
    : text;
  if (!code?.trim()) throw new Error(`No Rig program found in ${path}`);

  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const features = new Set<string>();
  let agentCount = 0;
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (name === "agent") agentCount += 1;
      if (["agent", "workflow", "defineTool", "repair", "steering", "timeout", "configureAgent"].includes(name)) {
        features.add(name);
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const owner = node.expression.text;
      if (["p", "s", "call"].includes(owner) || node.name.text === "use") {
        features.add(`${owner}.${node.name.text}`);
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "rig/globals") {
      features.add("rig/globals");
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "addons") {
      features.add("addons");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const bucket = features.has("workflow") || features.has("rig/globals") ? "workflows"
    : agentCount > 1 ? "delegation"
    : features.has("defineTool") ? "tools"
    : features.has("addons") || features.has("timeout") || features.has("configureAgent") ||
      [...features].some((feature) => feature.endsWith(".use")) ? "runtime"
    : [...features].some((feature) => feature.startsWith("p.")) ? "context"
    : "schemas";
  const slug = basename(path).replace(/^\d+-/, "").replace(/\.(md|ts)$/, "").replace(/-(?:v?\d+)$/, "");
  const roles = [...code.matchAll(/\/\/ (?:Agent|Workflow) role:\s*(.*)/g)].map((match) => match[1]!);
  const family = roleFamilies.find(([pattern]) => pattern.test(roles.at(-1) ?? ""))?.[1] ?? familyAliases[slug] ?? slug;
  const cluster = clusters.find(([, pattern]) => pattern.test(family))?.[0] ?? "Operations and harness patterns";
  const fingerprintParts: string[] = [];
  function fingerprintNode(node: ts.Node): void {
    const text = ts.isIdentifier(node) || ts.isLiteralExpression(node) ||
      ts.isTemplateLiteralToken(node) ? node.text : "";
    fingerprintParts.push(JSON.stringify([node.kind, ts.isVariableDeclarationList(node) ? node.flags : 0, text]));
    ts.forEachChild(node, fingerprintNode);
    fingerprintParts.push(")");
  }
  fingerprintNode(source);
  return {
    path,
    format,
    bucket,
    cluster,
    family,
    roles,
    features: [...features].sort(),
    fingerprint: createHash("sha256").update(fingerprintParts.join("")).digest("hex"),
  };
}

export function readCatalog(root: string): Sample[] {
  return ([
    ["skills/rig/samples", ".md"],
    ["src/samples", ".ts"],
  ] as const).flatMap(([directory, extension]) =>
    readdirSync(resolve(root, directory))
      .filter((file) => /^\d+-/.test(file) && file.endsWith(extension))
      .map((file) => {
        const path = `${directory}/${file}`;
        return classifySample(path, readFileSync(resolve(root, path), "utf8"));
      }),
  ).sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
}

export function checkCatalog(samples: Sample[], retirements: Retirement[]): void {
  const paths = new Set(samples.map((sample) => sample.path));
  const fingerprints = new Map<string, string>();
  for (const sample of samples) {
    const key = `${sample.format}:${sample.fingerprint}`;
    const previous = fingerprints.get(key);
    if (previous) throw new Error(`Duplicate program: ${sample.path} repeats ${previous}`);
    fingerprints.set(key, sample.path);
  }
  for (const { removed, retained } of retirements) {
    if (paths.has(removed)) throw new Error(`Retired duplicate reintroduced: ${removed}`);
    if (!paths.has(retained)) throw new Error(`Missing replacement for ${removed}: ${retained}`);
  }
}

export function renderCatalog(samples: Sample[], retirements: Retirement[]): string {
  const markdownCount = samples.filter((sample) => sample.format === "markdown").length;
  const lines = [
    "# Sample catalog",
    "",
    "Generated by `npm run sample:catalog`; do not edit the inventory by hand.",
    "",
    `${samples.length} samples: ${markdownCount} Markdown programs and ${samples.length - markdownCount} TypeScript fixtures.`,
    "Every sample has one primary **pattern bucket**, a **topic cluster**, and a normalized task **family**.",
    "Buckets come from program syntax, not filenames. A workflow with tools stays in workflows; a coordinator with tools stays in delegation.",
    "Markdown and TypeScript versions are kept separately because they exercise different launcher contracts; provider integration fixtures are also intentional.",
    "Legacy filenames are stable identifiers, not an authoritative description of the code. Read the role comments and program before choosing a sample.",
    "",
    "## Choose a pattern",
    "",
    "| Bucket | Samples | Read when |",
    "|--------|---------|-----------|",
  ];
  const descriptions: Record<keyof typeof buckets, string> = {
    schemas: "Typed caller inputs and constrained outputs without workspace intents.",
    context: "Reading or discovering workspace context and declaring output side effects.",
    runtime: "Invocation options, engines, timeouts, repair, steering, and addon hooks.",
    tools: "Model-callable deterministic operations, parsing, and Node.js APIs.",
    delegation: "Named specialists coordinated by a model-driven root agent.",
    workflows: "Explicit sequencing, bounded fan-out, pipelines, budgets, and nested workflows.",
  };
  for (const [bucket, title] of Object.entries(buckets)) {
    const key = bucket as keyof typeof buckets;
    lines.push(`| [${title}](#${bucket}) | ${samples.filter((sample) => sample.bucket === key).length} | ${descriptions[key]} |`);
  }
  lines.push("", "Use `node scripts/sample-catalog.ts --json` for the complete inventory with role comments, task families, and exercised APIs.",
    "For a focused search, append `--family <slug>` or `--bucket <key>`; bucket keys are `schemas`, `context`, `runtime`, `tools`, `delegation`, and `workflows`.",
    "");
  for (const [bucket, title] of Object.entries(buckets)) {
    lines.push(`<a id="${bucket}"></a>`, "", `## ${title}`, "");
    const members = samples.filter((sample) => sample.bucket === bucket);
    for (const cluster of [...new Set(members.map((sample) => sample.cluster))].sort()) {
      lines.push(`### ${cluster}`, "", "| Family | Samples |", "|--------|---------|");
      const group = members.filter((sample) => sample.cluster === cluster);
      for (const family of [...new Set(group.map((sample) => sample.family))].sort()) {
        const links = group.filter((sample) => sample.family === family).map((sample) => {
          const href = relative("skills/rig", sample.path);
          return `[${basename(sample.path)}](${href})`;
        });
        lines.push(`| ${family} | ${links.join(", ")} |`);
      }
      lines.push("");
    }
  }
  lines.push("## Consolidation policy", "",
    "Remove repeated lessons, not merely repeated API calls. Reworded prompts, renamed fields, new sample numbers, changed thresholds, and different filenames are not a new lesson.",
    "Keep variants that demonstrate a materially different input contract, side effect, tool behavior, provider, or coordination strategy. Exact program copies within one format are rejected by `npm run sample:check`; semantic duplicates still require reviewing the nearest family members.",
    "Before adding a sample, read the closest programs and explain the missing lesson. Update an existing example instead of adding a cosmetic variant. Regenerate this catalog and run `npm run sample:check`.",
    "The daily generator uses `scripts/sample-themes.ts` to seed diverse domain / artifact / constraint combinations, remembers recent theme IDs, and reports its replayable random seed. A new theme is not permission to repeat an existing lesson.",
    "", "## Retired duplicates", "",
    "Numbers are not reused or renumbered. These replacements preserve the distinct lesson; the original files remain available in Git history.",
    "", "| Removed | Retained |", "|---------|----------|");
  for (const { removed, retained } of retirements) {
    lines.push(`| ${basename(removed)} | [${basename(retained)}](${relative("skills/rig", retained)}) |`);
  }
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const samples = readCatalog(root);
  const retirements = JSON.parse(readFileSync(resolve(root, "skills/rig/sample-retirements.json"), "utf8")) as Retirement[];
  const { values } = parseArgs({
    options: {
      json: { type: "boolean" },
      write: { type: "boolean" },
      check: { type: "boolean" },
      family: { type: "string" },
      bucket: { type: "string" },
    },
  });
  if (values.bucket && !Object.hasOwn(buckets, values.bucket)) {
    throw new Error(`Unknown sample bucket: ${values.bucket}`);
  }
  if ([values.json, values.write, values.check].filter(Boolean).length > 1 ||
      ((values.family || values.bucket) && !values.json)) {
    throw new Error("Choose one of --json, --write, or --check; filters require --json.");
  }
  const catalogPath = resolve(root, "skills/rig/samples.md");
  if (values.json) {
    const selected = samples.filter((sample) =>
      (!values.family || sample.family === values.family) &&
      (!values.bucket || sample.bucket === values.bucket));
    console.log(JSON.stringify(selected, null, 2));
  } else {
    checkCatalog(samples, retirements);
    const markdown = renderCatalog(samples, retirements);
    if (values.write) {
      writeFileSync(catalogPath, markdown);
      console.log(`Cataloged ${samples.length} samples in skills/rig/samples.md`);
    } else if (values.check) {
      if (readFileSync(catalogPath, "utf8") !== markdown) {
        throw new Error("Sample catalog is stale. Run npm run sample:catalog.");
      }
      console.log(`Checked ${samples.length} samples and ${retirements.length} retired duplicates.`);
    } else {
      console.log(markdown);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
