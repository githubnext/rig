import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, test } from "vitest";
import type { EachMapping } from "@jridgewell/trace-mapping";

const require = createRequire(import.meta.url);
const { SourceMapConsumer, SourceMapGenerator } = require("source-map-js");
const postcss = require("postcss");
const sourceContent = "$color: red;\n\na { color: $color; }";

function originalMap(options = {}) {
  const map = new SourceMapGenerator({ file: "input.css", ...options });
  map.addMapping({
    generated: { line: 1, column: 0 },
    original: { line: 3, column: 2 },
    source: "original.scss",
    name: "color",
  });
  map.setSourceContent("original.scss", sourceContent);
  return map;
}

test("every source-map-js dependency resolves to the local package", () => {
  const base = new URL("../", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("package.json", base), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("package-lock.json", base), "utf8"));
  expect(manifest.overrides["source-map-js"]).toBe("$source-map-js");
  const entries = Object.keys(lock.packages).filter((key) => key.endsWith("/source-map-js"));
  expect(entries).toEqual(["node_modules/source-map-js"]);
  const entry = lock.packages[entries[0]!];
  expect(entry.link).toBe(true);
  expect(entry.resolved).toBe("packages/source-map-compat");
  expect(lock.packages[entry.resolved].name).toBe("@rig/source-map-compat");
  expect(require.resolve("source-map-js")).toBe(
    new URL("packages/source-map-compat/index.cjs", base).pathname,
  );
  const local = JSON.parse(readFileSync(new URL(`${entry.resolved}/package.json`, base), "utf8"));
  expect(local.scripts).toBeUndefined();
  expect(JSON.stringify(lock)).not.toMatch(/source-map-js-1\.2\.2\.tgz/);
});

test("CommonJS and ESM deep imports expose the same generator", async () => {
  const deep = require.resolve("source-map-js/lib/source-map-generator.js");
  expect(require(deep).SourceMapGenerator).toBe(SourceMapGenerator);
  expect((await import(deep)).SourceMapGenerator).toBe(SourceMapGenerator);
});

test("maps round-trip positions, names, unmapped segments, and content", () => {
  const map = originalMap();
  map.addMapping({ generated: { line: 1, column: 5 } });
  const consumer = new SourceMapConsumer(map.toString());
  expect(consumer.originalPositionFor({ line: 1, column: 4 })).toEqual({
    source: "original.scss", line: 3, column: 2, name: "color",
  });
  expect(consumer.originalPositionFor({ line: 1, column: 5 })).toEqual({
    source: null, line: null, column: null, name: null,
  });
  expect(consumer.sourceContentFor("original.scss")).toBe(sourceContent);
  expect(consumer.hasContentsOfAllSources()).toBe(true);
  const mappings: EachMapping[] = [];
  consumer.eachMapping(function (this: EachMapping[], mapping: EachMapping) {
    this.push(mapping);
  }, mappings);
  expect(mappings).toHaveLength(2);
  expect(mappings[0]?.originalLine).toBe(3);
});

test("missing content differs from unknown sources, and malformed maps throw", () => {
  const consumer = new SourceMapConsumer({ version: 3, sources: ["input.css"], names: [], mappings: "AAAA" });
  expect(consumer.sourceContentFor("input.css")).toBeNull();
  expect(consumer.hasContentsOfAllSources()).toBe(false);
  expect(consumer.sourceContentFor("missing.css", true)).toBeNull();
  expect(() => consumer.sourceContentFor("missing.css")).toThrow(/Source not found/);
  expect(() => new SourceMapConsumer("{")).toThrow(SyntaxError);
});

test("indexed maps honor section offsets", () => {
  const consumer = new SourceMapConsumer({
    version: 3,
    sections: [{ offset: { line: 2, column: 5 }, map: originalMap().toJSON() }],
  });
  expect(consumer.originalPositionFor({ line: 3, column: 5 }).line).toBe(3);
  expect(consumer.originalPositionFor({ line: 3, column: 4 }).source).toBeNull();
});

test("fromSourceMap preserves output filenames and disabled source content", () => {
  const consumer = SourceMapConsumer.fromSourceMap(originalMap());
  consumer.file = "output.css";
  consumer.sourcesContent = null;
  const copy = SourceMapGenerator.fromSourceMap(consumer);
  expect(copy.toJSON().file).toBe("output.css");
  expect(new SourceMapConsumer(copy.toJSON()).sourceContentFor("original.scss")).toBeNull();
  copy._file = "minified.css";
  expect(copy.toJSON().file).toBe("minified.css");
});

test("invalid mappings throw unless explicitly ignored", () => {
  const invalid = { generated: { line: 1, column: -1 } };
  expect(() => new SourceMapGenerator().addMapping(invalid)).toThrow(/Invalid source map mapping/);
  const map = new SourceMapGenerator({ ignoreInvalidMapping: true });
  map.addMapping(invalid);
  expect(map.toJSON().mappings).toBe("");
  expect(() => map.applySourceMap(new SourceMapConsumer({
    version: 3, sources: [], names: [], mappings: "",
  }))).toThrow(/source file is required/);
});

test("chained maps preserve unrelated and unmapped segments and rebase sources", () => {
  const map = new SourceMapGenerator({ file: "output.css" });
  map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: "input.css" });
  map.addMapping({ generated: { line: 1, column: 5 } });
  map.addMapping({ generated: { line: 2, column: 0 }, original: { line: 4, column: 0 }, source: "other.css" });
  map.setSourceContent("other.css", "other CSS");
  map.applySourceMap(new SourceMapConsumer(originalMap().toJSON()), undefined, "../src");
  const consumer = new SourceMapConsumer(map.toJSON());
  expect(consumer.originalPositionFor({ line: 1, column: 0 })).toEqual({
    source: "../src/original.scss", line: 3, column: 2, name: "color",
  });
  expect(consumer.originalPositionFor({ line: 1, column: 5 }).source).toBeNull();
  expect(consumer.originalPositionFor({ line: 2, column: 0 }).source).toBe("other.css");
  expect(consumer.sourceContentFor("other.css")).toBe("other CSS");
  expect(consumer.sources).not.toContain("input.css");
});

test.each(["src", "https://example.com/src/"])("source root %s survives composition", (root) => {
  const map = new SourceMapGenerator({ sourceRoot: root });
  map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: "input.css" });
  map.applySourceMap(new SourceMapConsumer(originalMap().toJSON()));
  const consumer = new SourceMapConsumer(map.toJSON());
  const source = `${root.replace(/\/$/, "")}/original.scss`;
  expect(consumer.originalPositionFor({ line: 1, column: 0 }).source).toBe(source);
  expect(consumer.sourceContentFor(source)).toBe(sourceContent);
});

test("PostCSS generates and chains maps, including inline and content-free output", async () => {
  const plugin = {
    postcssPlugin: "change-color",
    Declaration(declaration: { value: string }) { declaration.value = "blue"; },
  };
  const first = await postcss([plugin]).process("a { color: red; }", {
    from: "/styles/input.css", to: "/styles/intermediate.css",
    map: { inline: false, annotation: false, prev: originalMap() },
  });
  const second = await postcss([plugin]).process(first.css, {
    from: "/styles/intermediate.css", to: "/styles/output.css",
    map: { inline: false, annotation: false, prev: first.map },
  });
  const consumer = new SourceMapConsumer(second.map.toJSON());
  expect(consumer.originalPositionFor({ line: 1, column: 4 }).source).toBe("original.scss");
  expect(consumer.originalPositionFor({ line: 1, column: 4 }).line).toBe(3);
  expect(second.css).toMatch(/blue/);
  const noContent = await postcss([plugin]).process(first.css, {
    from: "/styles/intermediate.css", to: "/styles/no-content.css",
    map: { inline: false, prev: first.map, sourcesContent: false },
  });
  expect(noContent.map.toJSON().sourcesContent.every((content: string | null) => content == null)).toBe(true);
  const inline = await postcss([plugin]).process("a { color: red; }", {
    from: "/styles/input.css", map: { inline: true },
  });
  expect(inline.css).toMatch(/sourceMappingURL=data:application\/json/);
});

test("PostCSS diagnostics point to the original source", () => {
  const input = new postcss.Input("a { color: red; }", {
    from: "/styles/input.css", map: { prev: originalMap() },
  });
  const error = input.error("bad color", 1, 5);
  expect(error.file).toBe("/styles/original.scss");
  expect(error.line).toBe(3);
  expect(error.column).toBe(3);
  expect(error.source).toBe(sourceContent);
});
