// Detects `import { ... } from "rig/addons"` and rewrites it to `from "rig"`.
// `rig/addons` is not a valid module path; all addon exports live in `"rig"`.

// Source-level scanner used by lint.js (operates on the full source string).
export function scanSource(source) {
  const problems = [];
  // Match: import { ... } from "rig/addons" or import { ... } from 'rig/addons'
  const re = /\bfrom\s*(["'])rig\/addons\1/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const matchStart = match.index;
    // Skip matches inside line comments or block comments.
    if (isInComment(source, matchStart)) continue;
    const quoteChar = match[1];
    const moduleStart = matchStart + match[0].indexOf(quoteChar);
    const moduleEnd = moduleStart + `${quoteChar}rig/addons${quoteChar}`.length;
    problems.push({
      start: moduleStart,
      end: moduleEnd,
      message: 'Import addons from "rig", not "rig/addons". The rig/addons path is not valid.',
      kind: "no-rig-addons-import",
      edits: [{ start: moduleStart, end: moduleEnd, text: `${quoteChar}rig${quoteChar}` }],
    });
  }
  return problems;
}

function isInComment(source, index) {
  // Scan from start to index, tracking comment and string state.
  let i = 0;
  while (i < index) {
    const ch = source[i];
    const nx = source[i + 1];
    if (ch === "/" && nx === "/") {
      const end = source.indexOf("\n", i + 2);
      const commentEnd = end === -1 ? source.length : end;
      if (index < commentEnd) return true;
      i = commentEnd;
    } else if (ch === "/" && nx === "*") {
      const end = source.indexOf("*/", i + 2);
      const commentEnd = end === -1 ? source.length : end + 2;
      if (index < commentEnd) return true;
      i = commentEnd;
    } else if (ch === "'" || ch === "\"" || ch === "`") {
      const stringStart = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; }
        else if (source[i] === ch) { i += 1; break; }
        else { i += 1; }
      }
      // index inside this string literal
      if (index >= stringStart && index < i) return true;
    } else {
      i += 1;
    }
  }
  return false;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow imports from "rig/addons" — all addon exports live in "rig"',
    },
    fixable: "code",
    schema: [],
    messages: {
      useRig: 'Import addons from "rig", not "rig/addons". The rig/addons path is not valid.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "rig/addons") return;
        context.report({
          node: node.source,
          messageId: "useRig",
          fix(fixer) {
            const raw = node.source.raw ?? JSON.stringify(node.source.value);
            const quote = raw[0];
            return fixer.replaceText(node.source, `${quote}rig${quote}`);
          },
        });
      },
    };
  },
};
