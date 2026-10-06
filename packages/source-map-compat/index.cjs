const { posix: path } = require("node:path");
const { URL } = require("node:url");
const {
  GenMapping, addMapping, fromMap, setSourceContent, toDecodedMap, toEncodedMap,
} = require("@jridgewell/gen-mapping");
const {
  AnyMap, eachMapping, originalPositionFor, sourceContentFor,
} = require("@jridgewell/trace-mapping");

/** @typedef {{ line: number, column: number }} Position */
/** @typedef {{ generated: Position, original?: Position | null, source?: string | null, name?: string | null }} Mapping */

/** @param {string | null | undefined} root @param {string} source */
function joinSource(root, source) {
  if (!root || /^\w+:/.test(source) || source.startsWith("//")) return source;
  if (/^\w+:\/\//.test(root)) return new URL(source, root.replace(/\/?$/, "/")).href;
  if (path.isAbsolute(source)) return source;
  return path.join(root, source);
}

/** @param {string | null | undefined} root @param {string} source */
function relativeSource(root, source) {
  if (!root) return source;
  if (/^\w+:\/\//.test(root)) {
    const base = new URL(root.replace(/\/?$/, "/"));
    const target = new URL(source, base);
    if (base.protocol !== target.protocol || base.host !== target.host) return source;
    return path.relative(base.pathname, target.pathname) + target.search + target.hash;
  }
  if (/^\w+:/.test(source) || path.isAbsolute(root) !== path.isAbsolute(source)) return source;
  if (!path.isAbsolute(root) && path.normalize(root).split("/")[0] !== path.normalize(source).split("/")[0]) {
    return source;
  }
  return path.relative(root, source);
}

class SourceMapConsumer {
  /** @param {Parameters<typeof AnyMap>[0]} map */
  constructor(map) {
    this._map = AnyMap(map);
  }

  /** @param {SourceMapGenerator} generator */
  static fromSourceMap(generator) {
    return new SourceMapConsumer(generator.toJSON());
  }

  get file() { return this._map.file; }
  set file(value) { this._map.file = value; }
  get sourceRoot() { return this._map.sourceRoot; }
  get sources() { return this._map.resolvedSources; }
  get sourcesContent() { return this._map.sourcesContent; }
  /** @param {(string | null)[] | null | undefined} value */
  set sourcesContent(value) { this._map.sourcesContent = value ?? undefined; }

  /** @param {import("@jridgewell/trace-mapping").Needle} position */
  originalPositionFor(position) {
    return originalPositionFor(this._map, position);
  }

  /** @param {(mapping: import("@jridgewell/trace-mapping").EachMapping) => void} callback @param {unknown} [context] */
  eachMapping(callback, context) {
    eachMapping(this._map, context === undefined ? callback : callback.bind(context));
  }

  /** @param {string} source @param {boolean} [nullOnMissing] */
  sourceContentFor(source, nullOnMissing = false) {
    if (!this._map.sources.includes(source) && !this.sources.includes(source)) {
      if (nullOnMissing) return null;
      throw new Error(`Source not found in source map: ${source}`);
    }
    return sourceContentFor(this._map, source);
  }

  hasContentsOfAllSources() {
    const content = this.sourcesContent;
    return content != null && this.sources.every((_, index) => content[index] != null);
  }
}

class SourceMapGenerator {
  /** @param {import("@jridgewell/gen-mapping").Options & { ignoreInvalidMapping?: boolean }} [options] */
  constructor(options = {}) {
    this._map = new GenMapping(options);
    this._ignoreInvalidMapping = options.ignoreInvalidMapping === true;
  }

  get _file() { return this._map.file; }
  set _file(value) { this._map.file = value; }

  /** @param {SourceMapConsumer} consumer @param {{ ignoreInvalidMapping?: boolean }} [options] */
  static fromSourceMap(consumer, options = {}) {
    const generator = new SourceMapGenerator(options);
    generator._map = fromMap(consumer._map);
    return generator;
  }

  /** @param {Mapping} mapping */
  addMapping(mapping) {
    /** @param {Position | null | undefined} position */
    const validPosition = (position) => position != null &&
      Number.isInteger(position.line) && position.line > 0 &&
      Number.isInteger(position.column) && position.column >= 0;
    const valid = validPosition(mapping.generated) &&
      (mapping.original == null
        ? mapping.source == null && mapping.name == null
        : validPosition(mapping.original) && mapping.source != null);
    if (!valid) {
      if (this._ignoreInvalidMapping) return;
      throw new Error("Invalid source map mapping");
    }
    if (mapping.original != null && mapping.source != null) {
      const entry = { generated: mapping.generated, original: mapping.original, source: mapping.source };
      if (mapping.name == null) addMapping(this._map, entry);
      else addMapping(this._map, { ...entry, name: mapping.name });
    } else {
      addMapping(this._map, { generated: mapping.generated });
    }
  }

  /** @param {string} source @param {string | null} content */
  setSourceContent(source, content) {
    setSourceContent(this._map, relativeSource(this._map.sourceRoot, source), content);
  }

  /** @param {SourceMapConsumer} consumer @param {string | null} [sourceFile] @param {string} [sourceMapPath] */
  applySourceMap(consumer, sourceFile = consumer.file, sourceMapPath) {
    if (sourceFile == null) throw new Error("A source file is required to apply a source map");
    const current = toDecodedMap(this._map);
    const previous = new SourceMapConsumer({ ...current, sourceRoot: undefined });
    const target = relativeSource(current.sourceRoot, sourceFile);
    const next = new SourceMapGenerator({
      file: current.file,
      sourceRoot: current.sourceRoot,
    });
    previous.eachMapping((mapping) => {
      let source = mapping.source;
      let line = mapping.originalLine;
      let column = mapping.originalColumn;
      let name = mapping.name;
      let content = source == null ? null : previous.sourceContentFor(source);
      if (source === target && line != null && column != null) {
        const original = consumer.originalPositionFor({ line, column });
        if (original.source != null) {
          source = relativeSource(current.sourceRoot, joinSource(sourceMapPath, original.source));
          line = original.line;
          column = original.column;
          name = original.name ?? name;
          content = consumer.sourceContentFor(original.source);
        }
      }
      const generated = { line: mapping.generatedLine, column: mapping.generatedColumn };
      if (source != null && line != null && column != null) {
        next.addMapping({ generated, source, original: { line, column }, name });
      } else {
        next.addMapping({ generated });
      }
      if (source != null && content != null) setSourceContent(next._map, source, content);
    });
    this._map = next._map;
  }

  toJSON() {
    return toEncodedMap(this._map);
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }
}

exports.SourceMapConsumer = SourceMapConsumer;
exports.SourceMapGenerator = SourceMapGenerator;
