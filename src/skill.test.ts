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

it("keeps runtime guidance small and routes detailed references", () => {
  const runtime = readFileSync(resolve(skillRoot, "runtime.md"), "utf8");
  expect(Buffer.byteLength(runtime)).toBeLessThan(6000);
  expect(runtime.trimEnd().split("\n").length).toBeLessThanOrEqual(110);
  expect(canonicalManifest.trimEnd().split("\n").length).toBeLessThanOrEqual(200);
  for (const file of ["launcher-details.md", "agentic-workflows.md", "engines.md", "debugging.md"]) {
    expect(runtime).toContain(`](./${file})`);
    expect(canonicalManifest).toContain(`](./${file})`);
    const content = readFileSync(resolve(skillRoot, file), "utf8");
    expect(Buffer.byteLength(content), file).toBeLessThan(12000);
    for (const [, link] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(link!)) continue;
      expect(existsSync(resolve(skillRoot, link!.split("#")[0]!)), `${file}: ${link}`).toBe(true);
    }
  }
});

it("requires literal printf source transport for Copilot SDK workflows", () => {
  expect(canonicalManifest).toContain("printf '%s\\n'");
  expect(canonicalManifest).toContain("one single-quoted argument per source line");
  expect(canonicalManifest).toContain("`'\"'\"'`");
  expect(canonicalManifest).toContain("Do not use heredocs");
  expect(canonicalManifest).toContain('bash: ["printf", "node"]');
});

it("requires a literal launch pipeline without shell preparation", () => {
  expect(canonicalManifest).toContain("The launch pipeline must begin with `printf`");
  expect(canonicalManifest).toContain("no `&&` prefix");
  const runtime = readFileSync(resolve(skillRoot, "runtime.md"), "utf8");
  expect(runtime).toContain("`/tmp/gh-aw/agent` is already provisioned");
  expect(runtime).toContain("prevalidated fixture, skip lint and typecheck");
  expect(runtime).toContain("permission parser treats heredoc");
  expect(runtime).toContain("pipeline instead, not a heredoc or a blanket shell grant");
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
