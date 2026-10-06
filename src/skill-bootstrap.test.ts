import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";

const temporaryDirs: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fixture(installed = false, npmExit = 0) {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), "rig-bootstrap-test-")));
  temporaryDirs.push(root);
  const skill = resolve(root, "installed skill");
  const bin = resolve(root, "bin");
  await mkdir(skill);
  await mkdir(bin);
  await copyFile(new URL("../skills/rig/run.ts", import.meta.url), resolve(skill, "run.ts"));
  await writeFile(resolve(skill, "package.json"), JSON.stringify({
    type: "module",
    dependencies: { "@github/copilot-sdk": "1.0.16", "@types/node": "25.9.1" },
  }));
  await writeFile(resolve(skill, "rig.ts"), `
export async function runLauncherCli() {
  let stdin = "";
  for await (const chunk of process.stdin) stdin += chunk;
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), stdin }));
}
`);
  const npmLog = resolve(root, "npm.json");
  await writeFile(resolve(bin, "npm"), `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(npmLog)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
console.log("npm stdout");
console.error("npm stderr");
process.exit(${npmExit});
`);
  await chmod(resolve(bin, "npm"), 0o755);
  if (installed) {
    const sdk = resolve(skill, "node_modules/@github/copilot-sdk");
    const types = resolve(skill, "node_modules/@types/node");
    await mkdir(sdk, { recursive: true });
    await mkdir(types, { recursive: true });
    await writeFile(resolve(sdk, "index.js"), "");
    await writeFile(resolve(types, "package.json"), "{}");
  }
  return { root, skill, bin, npmLog };
}

async function run(f: Awaited<ReturnType<typeof fixture>>, path = `${f.bin}${delimiter}${process.env.PATH}`) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [resolve(f.skill, "run.ts"), "--typecheck"], {
      cwd: f.root,
      env: { ...process.env, PATH: path },
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => resolve({ code, stdout, stderr }));
    child.stdin.end("export default 'test';\n");
  });
}

it("bootstraps an installed skill using only the Node entry point", async () => {
  const f = await fixture();
  const result = await run(f);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    argv: ["--typecheck"], cwd: f.root, stdin: "export default 'test';\n",
  });
  expect(JSON.parse(await readFile(f.npmLog, "utf8"))).toEqual({
    argv: ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"],
    cwd: f.skill,
  });
  expect(result.stderr).toContain("Installing missing Rig dependencies");
  expect(result.stderr).toContain("npm stdout");
  expect(result.stderr).toContain("npm stderr");
});

it("does not invoke npm when dependencies already resolve", async () => {
  const f = await fixture(true);
  const result = await run(f, "");
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout).cwd).toBe(f.root);
  await expect(readFile(f.npmLog)).rejects.toMatchObject({ code: "ENOENT" });
});

it("launches through a symlink to the installed skill", async () => {
  const f = await fixture(true);
  const link = resolve(f.root, "linked skill");
  await symlink(f.skill, link, "junction");
  const result = await run({ ...f, skill: link }, "");
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).stdin).toBe("export default 'test';\n");
});

it("does not launch a program after dependency installation fails", async () => {
  const result = await run(await fixture(false, 23));
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Rig dependency installation failed (exit 23)");
});

it("reports missing npm rather than returning a successful result", async () => {
  const result = await run(await fixture(), "");
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Unable to start npm");
});

it("does not treat a malformed dependency package as a missing dependency", async () => {
  const f = await fixture(true);
  await writeFile(resolve(f.skill, "node_modules/@github/copilot-sdk/package.json"), "{");
  const result = await run(f);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Invalid package config");
  await expect(readFile(f.npmLog)).rejects.toMatchObject({ code: "ENOENT" });
});
