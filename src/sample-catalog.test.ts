import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkCatalog, classifySample, readCatalog, renderCatalog } from "../scripts/sample-catalog.ts";
import type { Retirement } from "../scripts/sample-catalog.ts";

function markdown(code: string): string {
  return `# Example\n\n\`\`\`rig\n${code}\n\`\`\`\n`;
}

describe("sample catalog", () => {
  it.each([
    ["schemas", 'export default agent({ output: s.enum("ok", "error") });'],
    ["context", 'export default agent({ instructions: p`Read ${p.read("README.md")}` });'],
    ["runtime", "export default agent({ addons: [repair()] });"],
    ["tools", 'const parser = defineTool("parse", {}); export default agent({ tools: [parser] });'],
    ["delegation", "const worker = agent({}); export default agent({ agents: { worker }, tools: [defineTool('x', {})] });"],
    ["workflows", "const worker = agent({}); export default workflow({ body: async ({ call }) => call(worker) });"],
    ["workflows", 'import { call } from "rig/globals"; export default await call.text("hello");'],
  ])("classifies %s from syntax", (bucket, code) => {
    expect(classifySample("skills/rig/samples/01-example.md", markdown(code)).bucket).toBe(bucket);
  });

  it("ignores comments and prompt text when classifying features", () => {
    const sample = classifySample("src/samples/01-example.ts", `
      // workflow({ body: () => {} })
      // Agent role: explain workflows.
      export default agent({ instructions: "Use workflow() and p.read()" });
    `);
    expect(sample.bucket).toBe("schemas");
    expect(sample.features).toEqual(["agent"]);
    expect(sample.roles).toEqual(["explain workflows."]);
  });

  it("groups versioned and synonymous task titles into a family", () => {
    const sample = classifySample("skills/rig/samples/432-sequential-commit-pipeline-v3.md", markdown("export default workflow({});"));
    expect(sample.family).toBe("sequential-commit-classifier-workflow");
    expect(sample.cluster).toBe("Git history and workspace");
  });

  it("uses the actual role when a legacy filename describes another task", () => {
    const sample = classifySample("skills/rig/samples/04-generate-readme.md", markdown(`
      // Agent role: diagnose the failing test result. Do not edit files.
      export default agent({});
    `));
    expect(sample.family).toBe("diagnose-test-failure");
    expect(sample.cluster).toBe("Tests and CI");
  });

  it("rejects markdown without a runnable block", () => {
    expect(() => classifySample("skills/rig/samples/01-empty.md", "# Empty")).toThrow("No Rig program");
  });

  it("rejects exact program copies while allowing separate launcher formats", () => {
    const first = classifySample("skills/rig/samples/01-first.md", markdown('export default agent({ model: "small" });'));
    const second = classifySample("skills/rig/samples/02-second.md", markdown(`
      // Agent role: same program with different formatting.
      export default agent({
        model: "small"
      });
    `));
    expect(() => checkCatalog([first, second], [])).toThrow("Duplicate program");
    const typescript = classifySample("src/samples/01-first.ts", 'export default agent({ model: "small" });');
    expect(() => checkCatalog([first, typescript], [])).not.toThrow();
  });

  it("checks retirement replacements and rejects reintroduced files", () => {
    const retained = classifySample("skills/rig/samples/01-retained.md", markdown("export default agent({});"));
    const retirement = { removed: "skills/rig/samples/02-retired.md", retained: retained.path };
    expect(() => checkCatalog([], [retirement])).toThrow("Missing replacement");
    expect(() => checkCatalog([retained], [{ removed: retained.path, retained: retained.path }])).toThrow("reintroduced");
    expect(() => checkCatalog([retained], [retirement])).not.toThrow();
  });

  it("preserves distinct literal values and declaration semantics in fingerprints", () => {
    const path = "src/samples/01-example.ts";
    const first = classifySample(path, 'const value = "one"; export default value;');
    const second = classifySample(path, 'const value = "two"; export default value;');
    const mutable = classifySample(path, 'let value = "one"; export default value;');
    expect(first.fingerprint).not.toBe(second.fingerprint);
    expect(first.fingerprint).not.toBe(mutable.fingerprint);
  });

  it("indexes every program exactly once without a retired duplicate section", () => {
    const root = resolve(import.meta.dirname, "..");
    const samples = readCatalog(root);
    const retirements = JSON.parse(readFileSync(resolve(root, "skills/rig/sample-retirements.json"), "utf8")) as Retirement[];
    checkCatalog(samples, retirements);
    const catalog = renderCatalog(samples);
    expect(readFileSync(resolve(root, "skills/rig/samples.md"), "utf8")).toBe(catalog);
    expect(catalog).not.toContain("## Retired duplicates");
    for (const sample of samples) {
      expect(catalog.split(`[${sample.path.split("/").at(-1)}]`)).toHaveLength(2);
    }
  });
});
