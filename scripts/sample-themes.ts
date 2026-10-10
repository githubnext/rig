import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const domains = [
  "public transit", "weather and climate", "education", "accessibility",
  "libraries and archives", "sports and recreation", "food and recipes",
  "ecology", "media production", "community events", "manufacturing",
  "inventory and logistics", "scientific experiments", "energy usage",
  "travel planning", "language learning",
] as const;

const artifacts = [
  "event timelines", "tabular measurements", "nested catalogs",
  "free-form reports", "linked records", "resource schedules",
] as const;

const constraints = [
  "partial observations", "conflicting sources", "unit conversion",
  "bounded resource budgets", "multilingual labels", "incremental updates",
] as const;

export interface Theme {
  id: string;
  domain: string;
  artifact: string;
  constraint: string;
}

export function seedThemes(count: number, seed: string, excluded: readonly string[] = []): Theme[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
    throw new Error("Theme count must be an integer from 1 to 20.");
  }
  if (!seed.trim()) throw new Error("Theme seed must not be empty.");
  const excludedIds = new Set(excluded);
  const candidates = domains.flatMap((domain) =>
    artifacts.flatMap((artifact) =>
      constraints.map((constraint) => ({
        id: `${domain}/${artifact}/${constraint}`,
        domain,
        artifact,
        constraint,
      })),
    ),
  ).filter((theme) => !excludedIds.has(theme.id));
  const ranked = candidates.map((theme) => ({
    theme,
    rank: createHash("sha256").update(JSON.stringify([seed, theme.id])).digest("hex"),
  })).sort((left, right) => left.rank.localeCompare(right.rank));
  const selected: Theme[] = [];
  const selectedDomains = new Set<string>();
  for (const { theme } of ranked) {
    if (selectedDomains.has(theme.domain)) continue;
    selected.push(theme);
    selectedDomains.add(theme.domain);
    if (selected.length === count) return selected;
  }
  for (const { theme } of ranked) {
    if (selected.some((previous) => previous.id === theme.id)) continue;
    selected.push(theme);
    if (selected.length === count) return selected;
  }
  throw new Error(`Not enough unseen themes: requested ${count}, found ${selected.length}.`);
}

function main(): void {
  const { values } = parseArgs({
    options: {
      count: { type: "string", default: "10" },
      seed: { type: "string" },
      exclude: { type: "string" },
    },
  });
  const seed = values.seed ?? randomBytes(16).toString("hex");
  let excluded: string[] = [];
  if (values.exclude && existsSync(values.exclude)) {
    const cache: unknown = JSON.parse(readFileSync(values.exclude, "utf8"));
    if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
      throw new Error("Theme cache must be an object.");
    }
    if ("recentThemes" in cache) {
      const recent = cache.recentThemes;
      if (!Array.isArray(recent) || !recent.every((id: unknown) => typeof id === "string")) {
        throw new Error("Theme cache recentThemes must be an array of strings.");
      }
      excluded = recent;
    }
  }
  console.log(JSON.stringify({ seed, themes: seedThemes(Number(values.count), seed, excluded) }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
