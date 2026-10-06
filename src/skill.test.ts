import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = resolve(repoRoot, "skills/rig");
const canonicalManifest = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");

it("keeps the exportable Rig skill as the only manifest", () => {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/;
  const metadata = canonicalManifest.match(frontmatter)?.[1];
  expect(metadata).toBeDefined();
  expect(metadata).toContain("name: rig\n");
  expect(metadata).toContain("license: MIT\n");
  expect(metadata).toContain("compatibility: Requires Node.js 24");
  expect(existsSync(resolve(repoRoot, ".github/skills/rig/SKILL.md"))).toBe(false);
});

it("keeps every canonical skill reference available", () => {
  const links = [...canonicalManifest.matchAll(/\]\((\.\/[^)]+)\)/g)];
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    expect(existsSync(resolve(skillRoot, link[1]!)), link[1]).toBe(true);
  }
});

it("requires fresh seven-character and quoted heredoc delimiters", () => {
  expect(canonicalManifest).toContain("7-character pseudo-random alphanumeric delimiter without a tool call");
  expect(canonicalManifest).not.toContain("randomBytes");
  expect(canonicalManifest).toContain("regenerate on collision");
  expect(canonicalManifest).toContain("Single-quote the opening delimiter");
  expect(canonicalManifest).not.toContain("<<'RIG'");
});

it("requires direct Node launch without shell preparation", () => {
  expect(canonicalManifest).toContain("Choose the seven characters yourself");
  expect(canonicalManifest).toContain("The launch command must begin with `node`");
  expect(canonicalManifest).toContain("no `&&` prefix");
  expect(canonicalManifest).toContain("does\nnot disable Bash or `node`");
  const runtime = readFileSync(resolve(skillRoot, "runtime.md"), "utf8");
  expect(runtime).toContain("`/tmp/gh-aw/agent` is already provisioned");
  expect(runtime).toContain("prevalidated fixture, skip lint and typecheck");
  expect(runtime).toContain("permission parser treats heredoc");
  expect(runtime).toContain("Do not broaden the shell allowlist");
});

it("exposes the same public modules from the standalone skill and repository", () => {
  const repositoryPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const skillPackage = JSON.parse(readFileSync(resolve(skillRoot, "package.json"), "utf8"));
  const expectedExports = Object.fromEntries(
    Object.entries(repositoryPackage.exports).map(([name, path]) => [
      name, String(path).replace("./skills/rig/", "./"),
    ]),
  );
  expect(skillPackage.name).toBe("rig");
  expect(skillPackage.type).toBe("module");
  expect(skillPackage.engines.node).toBe(">=24");
  expect(skillPackage.exports).toEqual(expectedExports);
  for (const path of Object.values(expectedExports)) {
    expect(existsSync(resolve(skillRoot, path)), path).toBe(true);
  }
});
