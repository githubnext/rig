import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { seedThemes } from "../scripts/sample-themes.ts";
import type { Theme } from "../scripts/sample-themes.ts";

const script = resolve(import.meta.dirname, "../scripts/sample-themes.ts");

function runCli(args: string[]): { seed: string; themes: Theme[] } {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as { seed: string; themes: Theme[] };
}

describe("sample theme seeding", () => {
  it("replays a seed and varies themes for a different seed", () => {
    expect(seedThemes(10, "first")).toEqual(seedThemes(10, "first"));
    expect(seedThemes(10, "first")).not.toEqual(seedThemes(10, "second"));
  });

  it("selects distinct domains and themes for the daily batch", () => {
    const themes = seedThemes(10, "daily");
    expect(themes).toHaveLength(10);
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(10);
    expect(new Set(themes.map((theme) => theme.domain)).size).toBe(10);
    for (const theme of themes) {
      expect(theme.id).toBe(`${theme.domain}/${theme.artifact}/${theme.constraint}`);
    }
  });

  it("excludes recently used themes and can fill a bounded larger batch", () => {
    const previous = seedThemes(20, "daily").map((theme) => theme.id);
    const next = seedThemes(20, "daily", previous);
    expect(next).toHaveLength(20);
    expect(next.every((theme) => !previous.includes(theme.id))).toBe(true);
    expect(new Set(next.map((theme) => theme.id)).size).toBe(20);
  });

  it("draws a fresh random seed by default and replays it through the CLI", () => {
    const first = runCli(["--count", "4"]);
    const second = runCli(["--count", "4"]);
    expect(first.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(first.seed).not.toBe(second.seed);
    expect(runCli(["--count", "4", "--seed", first.seed])).toEqual(first);
  });

  it("reads recent theme IDs from the cache and surfaces malformed history", () => {
    const directory = mkdtempSync(resolve(import.meta.dirname, ".tmp-sample-themes-"));
    const cache = resolve(directory, "task-pool.json");
    try {
      const previous = seedThemes(4, "cache-test").map((theme) => theme.id);
      writeFileSync(cache, JSON.stringify({ pool: [], recentThemes: previous }));
      const next = runCli(["--count", "4", "--seed", "cache-test", "--exclude", cache]);
      expect(next.themes.every((theme) => !previous.includes(theme.id))).toBe(true);
      writeFileSync(cache, JSON.stringify({ recentThemes: "invalid" }));
      const invalid = spawnSync(process.execPath, [script, "--exclude", cache], { encoding: "utf8" });
      expect(invalid.status).not.toBe(0);
      expect(invalid.stderr).toContain("recentThemes must be an array of strings");
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it.each([0, -1, 1.5, 21, NaN])("rejects invalid count %s", (count) => {
    expect(() => seedThemes(count, "seed")).toThrow("Theme count");
  });

  it("rejects empty seeds and exhausted theme pools", () => {
    expect(() => seedThemes(1, " ")).toThrow("Theme seed");
    const excluded: string[] = [];
    while (true) {
      try {
        excluded.push(...seedThemes(1, "exhaustion", excluded).map((theme) => theme.id));
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Not enough unseen themes");
        break;
      }
    }
    expect(() => seedThemes(1, "exhaustion", excluded)).toThrow("Not enough unseen themes");
  });
});
