import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = resolve(repoRoot, "skills/rig");
const canonicalManifest = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
const registrationPath = resolve(repoRoot, ".github/skills/rig/SKILL.md");
const registration = readFileSync(registrationPath, "utf8");

it("registers the canonical Rig skill with matching discovery metadata", () => {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/;
  const metadata = canonicalManifest.match(frontmatter)?.[1];
  expect(metadata).toBeDefined();
  expect(registration.match(frontmatter)?.[1]).toBe(metadata);
  expect(metadata).toContain("name: rig\n");
  expect(metadata).toContain("license: MIT\n");
  expect(metadata).toContain("compatibility: Requires Node.js 24");
  const links = [...registration.matchAll(/\]\(([^)]+)\)/g)];
  expect(links).toHaveLength(1);
  expect(resolve(dirname(registrationPath), links[0]![1]!)).toBe(resolve(skillRoot, "SKILL.md"));
});

it("keeps every canonical skill reference available", () => {
  const links = [...canonicalManifest.matchAll(/\]\((references\/[^)]+)\)/g)];
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    expect(existsSync(resolve(skillRoot, link[1]!)), link[1]).toBe(true);
  }
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
