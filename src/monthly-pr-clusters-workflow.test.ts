import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const markdown = readFileSync(new URL("../.github/workflows/monthly-pr-clusters.md", import.meta.url), "utf8");
const script = markdown.match(/      script: \|\n([\s\S]*?)\nsafe-outputs:/)?.[1].replace(/^        /gm, "");
if (!script) throw new Error("Expected the monthly PR collection script");
const prompt = markdown.split("\n---\n")[1];

function pr(number: number, mergedAt: string | null, updatedAt = mergedAt ?? "2026-10-01T00:00:00Z") {
  return {
    number,
    title: `PR ${number}`,
    body: null,
    html_url: `https://github.com/githubnext/rig/pull/${number}`,
    merged_at: mergedAt,
    updated_at: updatedAt,
    labels: [{ name: "enhancement" }],
    base: { ref: number % 2 ? "main" : "release" },
  };
}

type PullRequest = ReturnType<typeof pr>;

async function collect(now: string, pages: PullRequest[][]) {
  class Clock extends Date {
    constructor(value: string | number = now) {
      super(value);
    }
  }
  const list = vi.fn(async ({ page }: { page: number }) => ({ data: pages[page - 1] ?? [] }));
  const writeFile = vi.fn(async (_path: string, _data: string) => {});
  const mkdir = vi.fn(async () => {});
  const execution = runInNewContext(`(async () => {${script}})()`, {
    Date: Clock,
    require: (name: string) => {
      if (name !== "node:fs/promises") throw new Error(`Unexpected import: ${name}`);
      return { mkdir, writeFile };
    },
    github: { rest: { pulls: { list } } },
    context: { repo: { owner: "githubnext", repo: "rig" }, runId: 12345 },
    process: { env: { GITHUB_RUN_ATTEMPT: "2" } },
    core: { info: vi.fn() },
  });
  await execution;
  const write = writeFile.mock.calls[0];
  return { dataset: JSON.parse(write[1]), list, writeFile, mkdir };
}

describe("Monthly PR clusters workflow", () => {
  it("generates Rig source at runtime instead of concretizing it in the prompt", () => {
    expect(prompt).not.toMatch(/```(?:rig|ts|typescript|javascript)/);
    expect(prompt).not.toContain("export default");
    expect(prompt).toContain("design the Rig at runtime");
    expect(markdown).toContain('cron: "0 9 * * *"');
    expect(markdown).toContain("workflow_dispatch:");
    expect(markdown).toContain("\nmodel: small\n");
    expect(markdown).toContain("copilot-sdk: true");
    expect(markdown).toContain("  - skills/rig");
    expect(markdown).toContain("  - shared/rig.md");
    expect(markdown).toContain("run: npm ci");
  });

  it("preserves experiments in dedicated repo-memory and publishes only through safe outputs", () => {
    expect(markdown).toContain("id: pr-cluster-rigs");
    expect(markdown).toContain("branch-name: memory/pr-cluster-rigs");
    expect(markdown).toContain('file-glob: ["*.json"]');
    expect(markdown).toContain("cancel-in-progress: false");
    expect(prompt).toContain("On **every execution**");
    expect(prompt).toContain("from every record");
    expect(prompt).toContain("complete source of the five most recent");
    expect(prompt).toContain("including failed");
    expect(prompt).toContain("not just names, prompts, model selection");
    expect(prompt).toContain("complete verbatim source for each attempt");
    expect(prompt).toContain("Do not overwrite or delete historical records");
    expect(prompt).toContain("**complete, verbatim generated Rig source**");
    expect(prompt).toContain("**`create-issue` safe output**");
    expect(markdown).toContain("close-older-issues: false");
    expect(markdown).not.toMatch(/(?:contents|issues|pull-requests): write/);
  });

  it("uses the compiler's actual memory mount for reads and writes", () => {
    const lock = readFileSync(new URL("../.github/workflows/monthly-pr-clusters.lock.yml", import.meta.url), "utf8");
    const memoryPath = lock.match(/MEMORY_DIR: (\/tmp\/gh-aw\/repo-memory\/pr-cluster-rigs)/)?.[1];
    expect(memoryPath).toBeDefined();
    expect(prompt.split(`\`${memoryPath}/\``)).toHaveLength(3);
    expect(lock).toContain("push_repo_memory:");
    expect(lock).toContain("contents: write");
  });

  it("requires exact coverage, top-three ranking, and honest empty or failed outcomes", () => {
    expect(prompt).toContain("each input PR belongs to exactly");
    expect(prompt).toContain("size descending, breaking ties by");
    expect(prompt).toContain("derive the top three");
    expect(prompt).toContain("Do not force");
    expect(prompt).toContain("If there are no merged PRs, call `noop`");
    expect(prompt).toContain("call\n`report_incomplete` and stop");
    expect(prompt).toContain("at most two source attempts and two executions");
    expect(prompt).toContain("search existing issues for this exact run ID and attempt");
    expect(prompt).toContain("under 60,000 characters");
  });

  it("collects all base branches using merged timestamps, excluding closed-unmerged PRs", async () => {
    const { dataset, list, writeFile } = await collect("2026-10-07T17:54:03.135Z", [[
      pr(6, "2026-10-07T17:54:03.135Z"),
      pr(5, "2026-09-07T17:54:03.134Z"),
      pr(4, null),
      pr(3, "2026-09-07T17:54:03.135Z"),
      pr(2, "2026-10-01T00:00:00Z"),
    ]]);
    expect(dataset).toMatchObject({
      repository: "githubnext/rig",
      runId: "12345",
      runAttempt: "2",
      window: { start: "2026-09-07T17:54:03.135Z", end: "2026-10-07T17:54:03.135Z" },
      complete: true,
      pagesFetched: 1,
    });
    expect(dataset.prs.map((entry: PullRequest) => entry.number)).toEqual([2, 3]);
    expect(dataset.prs[0]).toMatchObject({
      title: "PR 2", body: "", labels: ["enhancement"], baseBranch: "release",
      url: "https://github.com/githubnext/rig/pull/2", mergedAt: "2026-10-01T00:00:00Z",
    });
    expect(list).toHaveBeenCalledWith({
      owner: "githubnext", repo: "rig", state: "closed", sort: "updated",
      direction: "desc", per_page: 100, page: 1,
    });
    expect(writeFile).toHaveBeenCalledWith("/tmp/gh-aw/agent/merged-prs.json", expect.any(String));
  });

  it.each([
    ["2026-03-31T12:30:00.000Z", "2026-02-28T12:30:00.000Z"],
    ["2024-03-31T12:30:00.000Z", "2024-02-29T12:30:00.000Z"],
    ["2026-01-01T00:00:00.000Z", "2025-12-01T00:00:00.000Z"],
  ])("clamps the calendar-month window correctly for %s", async (end, start) => {
    const { dataset } = await collect(end, [[]]);
    expect(dataset.window).toEqual({ start, end });
    expect(dataset.prs).toEqual([]);
    expect(dataset.complete).toBe(true);
  });

  it("paginates beyond 100 PRs and deduplicates overlapping pages", async () => {
    const page = Array.from({ length: 100 }, (_, index) => pr(index + 1, "2026-09-15T00:00:00Z"));
    const { dataset, list } = await collect("2026-10-07T00:00:00Z", [
      page, [page[99], pr(101, "2026-09-16T00:00:00Z")],
    ]);
    expect(dataset.prs).toHaveLength(101);
    expect(list).toHaveBeenCalledTimes(2);
    expect(dataset.pagesFetched).toBe(2);
  });

  it("stops only after a whole page predates the merge window by update time", async () => {
    const old = Array.from({ length: 100 }, (_, index) =>
      pr(index + 1, "2026-08-01T00:00:00Z", "2026-08-02T00:00:00Z"));
    const { dataset, list } = await collect("2026-10-07T00:00:00Z", [old]);
    expect(dataset.prs).toEqual([]);
    expect(dataset.complete).toBe(true);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("does not stop on recently updated PRs merged outside the window", async () => {
    const outside = Array.from({ length: 100 }, (_, index) =>
      pr(index + 1, "2026-08-01T00:00:00Z", "2026-10-06T00:00:00Z"));
    const { dataset, list } = await collect("2026-10-07T00:00:00Z", [
      outside, [pr(101, "2026-09-15T00:00:00Z")],
    ]);
    expect(dataset.prs.map((entry: PullRequest) => entry.number)).toEqual([101]);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("refuses partial collection when the pagination budget is exhausted", async () => {
    const page = Array.from({ length: 100 }, (_, index) => pr(index + 1, "2026-09-15T00:00:00Z"));
    await expect(collect("2026-10-07T00:00:00Z", Array.from({ length: 100 }, () => page)))
      .rejects.toThrow("refusing to report a partial month");
  });

  it("propagates API failures instead of publishing an empty corpus", async () => {
    const list = vi.fn().mockRejectedValue(new Error("GitHub API unavailable"));
    const writeFile = vi.fn();
    await expect(runInNewContext(`(async () => {${script}})()`, {
      require: () => ({ mkdir: vi.fn(), writeFile }),
      github: { rest: { pulls: { list } } },
      context: { repo: { owner: "githubnext", repo: "rig" } },
    })).rejects.toThrow("GitHub API unavailable");
    expect(writeFile).not.toHaveBeenCalled();
  });
});
