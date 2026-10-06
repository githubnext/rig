# Build-time source maps

The root npm override resolves every `source-map-js` dependency to this local
package instead of fetching the `source-map-js@1.2.2` registry tarball.
Run `npm ci` normally; no install script or post-install patch is needed.

Adapted from [githubnext/gh-aw-cao's source-map adapter](https://github.com/githubnext/gh-aw-cao/tree/main/dashboard/site/packages/source-map-compat)
under the included MIT license. The synchronous generator and consumer APIs
used by PostCSS delegate encoding, decoding, indexed maps, and position lookup
to `@jridgewell/gen-mapping` and `@jridgewell/trace-mapping`. Chained maps,
original-source diagnostics, and embedded source content remain enabled.

This is scoped to build-tool consumers, not the complete `source-map-js` API:
`SourceNode`, reverse lookups, and original-order iteration are not implemented.

Run `npx vitest run src/source-map-compat.test.ts` to check dependency resolution
and source-map behavior, including PostCSS integration.
