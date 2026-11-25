import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const markdown = readFileSync(new URL("../.github/workflows/daily-rig-decomposition-bench.md", import.meta.url), "utf8");
const lock = readFileSync(new URL("../.github/workflows/daily-rig-decomposition-bench.lock.yml", import.meta.url), "utf8");

describe("Daily Rig Decomposition Benchmark workflow", () => {
  it("installs the pinned skill dependencies and compiler before restoring the skill and starting the agent", () => {
    const command = "npm install --prefix /tmp/gh-aw/.github/skills/rig --no-save --ignore-scripts --registry=https://registry.npmjs.org/ typescript@5.9.3";
    expect(markdown).toContain(`run: ${command}`);
    const download = lock.indexOf("name: Download activation artifact");
    const installation = lock.indexOf("name: Install benchmark dependencies");
    const restoration = lock.indexOf("name: Restore inline skills from activation artifact");
    const execution = lock.indexOf("name: Execute GitHub Copilot CLI");
    expect(download).toBeGreaterThan(-1);
    expect(installation).toBeGreaterThan(download);
    expect(restoration).toBeGreaterThan(installation);
    expect(execution).toBeGreaterThan(restoration);
    expect(lock.slice(installation, restoration)).toContain(`run: ${command}`);
    expect(markdown).toContain("strict: true");
    expect(markdown).not.toMatch(/strict-ssl|NODE_TLS_REJECT_UNAUTHORIZED/);
  });

  it("does not run untypechecked programs and uses a clearly marked fallback task", () => {
    expect(markdown).toContain("If typechecking fails, do not execute the benchmark.");
    expect(markdown).toContain("mark it as a fallback in the report");
    expect(markdown).toContain("The fallback is a task description, not a substitute for either solution or grading.");
  });

  it("allows the outer benchmark to run bounded subprocesses without relaxing generated-program imports", () => {
    expect(markdown).toContain('`spawn` from `"node:child_process"`');
    expect(markdown).toContain("capture stdout and stderr separately");
    expect(markdown).toContain("without interpolating source into a shell command");
    expect(markdown).toContain('still import only from `"rig"`');
    expect(markdown).toContain("each clamped\n  down to what is left");
  });

  it("writes the benchmark in bounded edits before typechecking and running it once", () => {
    expect(markdown).toContain("Write the program incrementally in several small file edits");
    expect(markdown).toContain("entire program in a single response");
    expect(markdown).toContain("The assembled file must still meet all of the requirements below.");
    expect(markdown).toContain("Run the program **exactly once**");
  });
});
