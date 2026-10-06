import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function runInstalledSkill(): Promise<void> {
  const require = createRequire(import.meta.url);
  const skillDir = dirname(fileURLToPath(import.meta.url));
  const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  const missing = Object.keys(manifest.dependencies).filter(name => {
    try {
      require.resolve(name.startsWith("@types/") ? `${name}/package.json` : name);
      return false;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") return true;
      throw error;
    }
  });

  if (missing.length > 0) {
    console.error(`Installing missing Rig dependencies: ${missing.join(", ")}`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npm", [
        "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false",
      ], { cwd: skillDir, stdio: ["ignore", 2, 2] });
      child.once("error", error => reject(new Error("Unable to start npm to install Rig dependencies.", { cause: error })));
      child.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Rig dependency installation failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
      });
    });
  }

  const { runLauncherCli } = await import("./rig.ts");
  await runLauncherCli();
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  runInstalledSkill().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
