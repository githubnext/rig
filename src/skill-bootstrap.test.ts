import { afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const temporaryDirs: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((path: string) => rm(path, { recursive: true, force: true })));
});

async function fixture(installed = true) {
  const root = await realpath(await mkdtemp(resolve(tmpdir(), "rig-bootstrap-test-")));
  temporaryDirs.push(root);
  const skill = resolve(root, "installed skill");
  await mkdir(skill);
  await copyFile(new URL("../skills/rig/run.ts", import.meta.url), resolve(skill, "run.ts"));
  await writeFile(resolve(skill, "package.json"), JSON.stringify({
    type: "module",
    dependencies: { "@github/copilot-sdk": "1.0.16", "@types/node": "25.9.1" },
  }));
  await writeFile(resolve(skill, "rig.ts"), `
import "@github/copilot-sdk";
export async function runLauncherCli() {
  let stdin = "";
  for await (const chunk of process.stdin) stdin += chunk;
  process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), stdin }));
}
`);
  if (installed) {
    const sdk = resolve(skill, "node_modules/@github/copilot-sdk");
    const types = resolve(skill, "node_modules/@types/node");
    await mkdir(sdk, { recursive: true });
    await mkdir(types, { recursive: true });
    await writeFile(resolve(sdk, "package.json"), JSON.stringify({ type: "module", exports: "./index.js" }));
    await writeFile(resolve(sdk, "index.js"), "");
    await writeFile(resolve(types, "package.json"), "{}");
  }
  return { root, skill };
}

async function run(f: Awaited<ReturnType<typeof fixture>>) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(process.execPath, [resolve(f.skill, "run.ts"), "--typecheck"], {
      cwd: f.root,
      env: { ...process.env, PATH: "" },
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", code => done({ code, stdout, stderr }));
    child.stdin.end("export default 'test';\n");
  });
}

it("launches an installed skill with only Node and no package manager on PATH", async () => {
  const f = await fixture();
  const result = await run(f);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({
    argv: ["--typecheck"], cwd: f.root, stdin: "export default 'test';\n",
  });
  expect(result.stderr).toBe("");
});

it("launches through a symlink to the installed skill", async () => {
  const f = await fixture(true);
  const link = resolve(f.root, "linked skill");
  await symlink(f.skill, link, "junction");
  const result = await run({ ...f, skill: link });
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).stdin).toBe("export default 'test';\n");
});

it("reports missing SDK dependencies without trying to install them", async () => {
  const result = await run(await fixture(false));
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Cannot find package '@github/copilot-sdk'");
});

it("does not treat a malformed dependency package as a missing dependency", async () => {
  const f = await fixture(true);
  await writeFile(resolve(f.skill, "node_modules/@github/copilot-sdk/package.json"), "{");
  const result = await run(f);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Invalid package config");
});

async function typecheckFixture() {
  const f = await fixture();
  await copyFile(new URL("../skills/rig/rig.ts", import.meta.url), resolve(f.skill, "rig.ts"));
  await copyFile(new URL("../skills/rig/tsconfig.json", import.meta.url), resolve(f.skill, "tsconfig.json"));
  await writeFile(resolve(f.skill, "node_modules/@github/copilot-sdk/index.js"), `
export class CopilotClient {}
export const RuntimeConnection = {};
export const approveAll = () => true;
`);
  return f;
}

it("typechecks with a host-provided compiler and no npm/npx on PATH", async () => {
  const f = await typecheckFixture();
  const compiler = resolve(f.skill, "node_modules/typescript/bin");
  await mkdir(compiler, { recursive: true });
  await writeFile(resolve(compiler, "../package.json"), JSON.stringify({ type: "module" }));
  const log = resolve(f.root, "compiler.json");
  await writeFile(resolve(compiler, "tsc.js"), `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(log)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
`);
  const result = await run(f);
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("typecheck passed\n");
  const invocation = JSON.parse(await readFile(log, "utf8"));
  expect(invocation.cwd).toBe(f.root);
  expect(invocation.argv).toEqual(["--project", expect.stringContaining("tsconfig.typecheck.json"), "--pretty", "false"]);
});

it("reports a missing compiler instead of downloading TypeScript", async () => {
  const result = await run(await typecheckFixture());
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Typecheck mode requires a preinstalled TypeScript compiler");
});
