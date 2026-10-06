import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export async function runInstalledSkill(): Promise<void> {
  const { runLauncherCli } = await import("./rig.ts");
  await runLauncherCli();
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  runInstalledSkill().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
