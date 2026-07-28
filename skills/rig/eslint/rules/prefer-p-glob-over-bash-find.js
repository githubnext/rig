function closingParen(tokens, openingIndex) {
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") depth += 1;
    if (tokens[index].value === ")") depth -= 1;
    if (depth === 0) return index;
  }
  return undefined;
}

function extractStringContent(raw) {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"'))
    || (t.startsWith("'") && t.endsWith("'"))
    || (t.startsWith("`") && t.endsWith("`"))
  ) {
    return t.slice(1, -1);
  }
  return null;
}

/**
 * Convert a simple `find DIR -name PATTERN` command to a glob pattern.
 * Returns null for commands with additional predicates (too complex to autofix).
 */
function findToGlob(findCmd) {
  const match = findCmd.match(/^find\s+(\S+)\s+-name\s+['"`]?([^\s'"` ]+)['"`]?\s*$/);
  if (!match) return null;
  const [, dir, pattern] = match;
  const prefix = dir === "." ? "**" : `${dir}/**`;
  return `${prefix}/${pattern}`;
}

export function scanTokens(tokens, source = "") {
  const problems = [];

  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const [pToken, dotToken, bashToken, openParenToken] = tokens.slice(index, index + 4);
    if (
      pToken.value !== "p"
      || dotToken.value !== "."
      || bashToken.value !== "bash"
      || openParenToken.value !== "("
    ) {
      continue;
    }

    // Skip member expressions like foo.p.bash(...)
    if (tokens[index - 1]?.value === ".") continue;

    const closeIndex = closingParen(tokens, index + 3);
    if (closeIndex === undefined) continue;

    const argText = source.slice(openParenToken.end, tokens[closeIndex].start).trim();
    const content = extractStringContent(argText);
    if (!content || !content.startsWith("find ")) continue;

    const globPattern = findToGlob(content);
    if (!globPattern) continue;

    const fixedText = `p.glob("${globPattern}")`;
    problems.push({
      start: pToken.start,
      end: tokens[closeIndex].end,
      message: `Prefer p.glob("${globPattern}") over p.bash() for static file discovery.`,
      kind: "prefer-p-glob-over-bash-find",
      edits: [{ start: pToken.start, end: tokens[closeIndex].end, text: fixedText }],
    });
  }

  return problems;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer p.glob() over p.bash(\"find ...\") for static file discovery",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferGlob: "Prefer p.glob(\"{{glob}}\") over p.bash() for static file discovery.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;
        if (
          callee.type !== "MemberExpression"
          || callee.computed
          || callee.object.type !== "Identifier"
          || callee.object.name !== "p"
          || callee.property.type !== "Identifier"
          || callee.property.name !== "bash"
          || args.length === 0
          || args[0].type !== "Literal"
          || typeof args[0].value !== "string"
          || !args[0].value.startsWith("find ")
        ) {
          return;
        }

        const globPattern = findToGlob(args[0].value);
        if (!globPattern) return;

        context.report({
          node,
          messageId: "preferGlob",
          data: { glob: globPattern },
          fix(fixer) {
            return fixer.replaceText(node, `p.glob("${globPattern}")`);
          },
        });
      },
    };
  },
};
