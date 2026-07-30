import { agent, currentWorkflow, log, phase } from "rig";

phase("Prepare");
log("program loaded");

(globalThis as { __launcherAmbientRun?: boolean }).__launcherAmbientRun = currentWorkflow() !== undefined;

const root = agent({
  name: "launcher-stdin-ambient-root",
});

export default root;
